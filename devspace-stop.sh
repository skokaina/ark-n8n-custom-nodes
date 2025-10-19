#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENV_YAML="devspace.env.yaml"
PORT_FORWARD_PID_FILE=".devspace/port-forward.pid"
NGROK_PID_FILE=".devspace/ngrok.pid"

echo "=== ARK n8n DevSpace Shutdown ==="
echo ""

STOPPED_SOMETHING=false

if [ -f "$NGROK_PID_FILE" ]; then
    NGROK_PID=$(cat "$NGROK_PID_FILE")
    if ps -p $NGROK_PID > /dev/null 2>&1; then
        echo "Stopping ngrok (PID $NGROK_PID)..."
        kill $NGROK_PID 2>/dev/null || true
        sleep 1

        if ps -p $NGROK_PID > /dev/null 2>&1; then
            echo "  Force killing ngrok..."
            kill -9 $NGROK_PID 2>/dev/null || true
        fi
        STOPPED_SOMETHING=true
    fi
    rm -f "$NGROK_PID_FILE"
fi

NGROK_PROCESSES=$(pgrep -f "ngrok http" || true)
if [ -n "$NGROK_PROCESSES" ]; then
    echo "Stopping remaining ngrok processes..."
    for pid in $NGROK_PROCESSES; do
        echo "  Killing PID $pid..."
        kill $pid 2>/dev/null || true
    done
    STOPPED_SOMETHING=true
fi

if [ -f "$PORT_FORWARD_PID_FILE" ]; then
    PF_PID=$(cat "$PORT_FORWARD_PID_FILE")
    if ps -p $PF_PID > /dev/null 2>&1; then
        echo "Stopping port-forward (PID $PF_PID)..."
        kill $PF_PID 2>/dev/null || true
        STOPPED_SOMETHING=true
    fi
    rm -f "$PORT_FORWARD_PID_FILE"
fi

PF_PROCESSES=$(pgrep -f "kubectl port-forward.*localhost-gateway-nginx.*:80" || true)
if [ -n "$PF_PROCESSES" ]; then
    echo "Stopping remaining port-forward processes..."
    for pid in $PF_PROCESSES; do
        echo "  Killing PID $pid..."
        kill $pid 2>/dev/null || true
    done
    STOPPED_SOMETHING=true
fi

if [ -f "$ENV_YAML" ]; then
    echo "Removing $ENV_YAML..."
    rm -f "$ENV_YAML"
    STOPPED_SOMETHING=true
fi

echo ""
if [ "$STOPPED_SOMETHING" = true ]; then
    echo "=== Shutdown Complete ==="
else
    echo "=== Nothing to stop ==="
fi
echo ""
