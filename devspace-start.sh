#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENV_FILE=".env"
ENV_YAML="devspace.env.yaml"
PORT_FORWARD_PID_FILE=".devspace/port-forward.pid"
NGROK_PID_FILE=".devspace/ngrok.pid"

echo "=== ARK n8n DevSpace Startup ==="
echo ""

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: $ENV_FILE not found!"
    echo "Please create $ENV_FILE based on .env.example"
    exit 1
fi

source "$ENV_FILE"

if [ -z "$NGROK_DOMAIN" ]; then
    echo "Error: NGROK_DOMAIN not set in $ENV_FILE"
    exit 1
fi

NGROK_PORT="${NGROK_PORT:-8080}"
NGROK_N8N_HOST_HEADER="${NGROK_N8N_HOST_HEADER:-ark-n8n-devspace.default.127.0.0.1.nip.io}"

echo "Configuration:"
echo "  NGROK_DOMAIN: $NGROK_DOMAIN"
echo "  NGROK_PORT: $NGROK_PORT"
echo "  NGROK_N8N_HOST_HEADER: $NGROK_N8N_HOST_HEADER"
echo ""

check_port() {
    local port=$1
    local pids=$(lsof -ti :$port 2>/dev/null || true)

    if [ -n "$pids" ]; then
        echo "Port $port is in use by the following processes:"
        echo ""

        for pid in $pids; do
            local cmd=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
            local full_cmd=$(ps -p $pid -o command= 2>/dev/null || echo "unknown")
            echo "  PID $pid: $cmd"
            echo "    Command: $full_cmd"
        done
        echo ""

        PS3="Select action: "
        options=("Stop all processes on port $port" "Continue anyway" "Exit")
        select opt in "${options[@]}"; do
            case $opt in
                "Stop all processes on port $port")
                    for pid in $pids; do
                        echo "Killing PID $pid..."
                        kill $pid 2>/dev/null || true
                    done
                    sleep 1
                    return 0
                    ;;
                "Continue anyway")
                    return 0
                    ;;
                "Exit")
                    exit 0
                    ;;
                *)
                    echo "Invalid option"
                    ;;
            esac
        done
    fi
}

check_gateway_health() {
    echo "Checking nginx gateway health..."

    local n8n_pod_ip=$(kubectl get pods -n default -l app=ark-n8n -o jsonpath='{.items[0].status.podIP}' 2>/dev/null || echo "")

    if [ -z "$n8n_pod_ip" ]; then
        echo "  Warning: Could not find n8n pod"
        return 0
    fi

    echo "  n8n pod IP: $n8n_pod_ip"

    local gateway_pod=$(kubectl get pods -n ark-system -l app.kubernetes.io/name=localhost-gateway-nginx -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

    if [ -z "$gateway_pod" ]; then
        echo "  Warning: Could not find gateway pod"
        return 0
    fi

    local upstream_ip=$(kubectl exec -n ark-system "$gateway_pod" -- cat /etc/nginx/conf.d/http.conf 2>/dev/null | grep -A 5 "upstream default_ark-n8n_5678" | grep "server " | awk '{print $2}' | cut -d: -f1 || echo "")

    if [ -z "$upstream_ip" ]; then
        echo "  Warning: Could not extract upstream IP from nginx config"
        return 0
    fi

    echo "  nginx upstream IP: $upstream_ip"

    if [ "$n8n_pod_ip" != "$upstream_ip" ]; then
        echo "  Gateway configuration is stale!"
        echo "  Reloading nginx gateway pod..."

        kubectl delete pod -n ark-system "$gateway_pod" 2>/dev/null || true

        echo "  Waiting for new gateway pod..."
        kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=localhost-gateway-nginx -n ark-system --timeout=60s

        echo "  Waiting for configuration to be pushed..."
        sleep 5

        echo "  Gateway reloaded successfully"
    else
        echo "  Gateway configuration is up to date"
    fi
}

echo "Step 1: Checking port availability..."
check_port $NGROK_PORT

echo ""
echo "Step 2: Checking nginx gateway health..."
check_gateway_health

echo ""
echo "Step 3: Generating devspace environment overrides..."

cat > "$ENV_YAML" <<EOF
# DevSpace configuration for n8n with ARK custom nodes
version: v2beta1

images:
  ark-n8n:
    image: ark-n8n
    dockerfile: Dockerfile
    context: .
    buildKit: {}
    docker:
      preferMinikube: false

pipelines:
  deploy: |-
    build_images --all
    create_deployments --all
  dev: |-
    build_images --all
    create_deployments --all
    start_dev --all

deployments:
  ark-n8n:
    namespace: default
    helm:
      chart:
        path: ./chart
      values:
        app:
          image:
            repository: \${runtime.images.ark-n8n.image}
            tag: \${runtime.images.ark-n8n.tag}
            pullPolicy: Never
          # Override resources for local development
          resources:
            limits:
              memory: "1024Mi"
              cpu: "1000m"
            requests:
              memory: "256Mi"
              cpu: "200m"
          # Override environment for dev mode via HTTPRoute
          env:
            N8N_HOST: $NGROK_N8N_HOST_HEADER
            WEBHOOK_URL: https://$NGROK_DOMAIN
            N8N_EDITOR_BASE_URL: https://$NGROK_DOMAIN
            N8N_PUSH_BACKEND: websocket
        httpRoute:
          enabled: true
          hostnames:
            - $NGROK_N8N_HOST_HEADER
            - $NGROK_DOMAIN
          origin: http://$NGROK_N8N_HOST_HEADER

dev:
  ark-n8n:
    imageSelector: ark-n8n
    namespace: default
    logs:
      lastLines: 50
    ports:
      - port: "5678:80"
    sync:
      - path: /tmp/n8n-devspace:/home/node/.n8n
        printLogs: true
        initialSync: preferRemote
EOF

echo "  Created $ENV_YAML with ngrok overrides"

echo ""
echo "Step 4: Starting kubectl port-forward..."

mkdir -p .devspace

if [ -f "$PORT_FORWARD_PID_FILE" ]; then
    OLD_PID=$(cat "$PORT_FORWARD_PID_FILE")
    if ps -p $OLD_PID > /dev/null 2>&1; then
        echo "  Stopping old port-forward (PID $OLD_PID)..."
        kill $OLD_PID 2>/dev/null || true
        sleep 1
    fi
fi

kubectl port-forward -n ark-system service/localhost-gateway-nginx $NGROK_PORT:80 > /dev/null 2>&1 &
PF_PID=$!
echo $PF_PID > "$PORT_FORWARD_PID_FILE"
echo "  Port-forward started (PID $PF_PID)"

sleep 2

if ! ps -p $PF_PID > /dev/null 2>&1; then
    echo "  Error: Port-forward failed to start"
    rm -f "$PORT_FORWARD_PID_FILE"
    exit 1
fi

echo ""
echo "Step 5: Starting ngrok..."

NGROK_RUNNING=$(pgrep -f "ngrok http.*$NGROK_PORT" || true)
if [ -n "$NGROK_RUNNING" ]; then
    echo "  ngrok is already running (PID $NGROK_RUNNING)"
    echo $NGROK_RUNNING > "$NGROK_PID_FILE"
else
    ngrok http $NGROK_PORT --host-header=$NGROK_N8N_HOST_HEADER --domain=$NGROK_DOMAIN > /dev/null 2>&1 &
    NGROK_PID=$!
    echo $NGROK_PID > "$NGROK_PID_FILE"
    echo "  ngrok started (PID $NGROK_PID)"

    sleep 3

    if ! ps -p $NGROK_PID > /dev/null 2>&1; then
        echo "  Error: ngrok failed to start"
        rm -f "$NGROK_PID_FILE"
        exit 1
    fi
fi

echo ""
echo "=== Startup Complete ==="
echo ""
echo "URLs:"
echo "  Local:  http://$NGROK_N8N_HOST_HEADER:$NGROK_PORT"
echo "  Public: https://$NGROK_DOMAIN"
echo ""
echo "Process IDs:"
echo "  Port-forward: $PF_PID"
echo "  ngrok: $(cat $NGROK_PID_FILE)"
echo ""
echo "To stop all services, run: ./devspace-stop.sh"
echo ""
