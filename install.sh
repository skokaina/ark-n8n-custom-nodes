#!/usr/bin/env bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
NAMESPACE="default"
ARK_API_URL=""
RELEASE_NAME="ark-n8n"
VERSION="latest"
DEMO_MODE=false

# Help text
show_help() {
  cat << EOF
ARK n8n Custom Nodes - Quick Install Script

Usage: $0 [OPTIONS]

Options:
  -n, --namespace NAMESPACE        Kubernetes namespace (default: default)
  -a, --ark-api-url URL            ARK API URL (default: auto-detect)
  -r, --release-name NAME          Helm release name (default: ark-n8n)
  -v, --version VERSION            Chart version (default: latest)
  -d, --demo                       Demo mode (disables authentication) ⚠️  INSECURE
  -h, --help                       Show this help message

Examples:
  # Basic install (auto-detects ARK API)
  $0

  # Install with custom ARK API URL
  $0 --ark-api-url https://ark-api.example.com

  # Install in specific namespace
  $0 --namespace production

  # Install specific version
  $0 --version 1.0.0

  # Install in demo mode (no authentication - TESTING ONLY)
  $0 --demo

EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -n|--namespace)
      NAMESPACE="$2"
      shift 2
      ;;
    -a|--ark-api-url)
      ARK_API_URL="$2"
      shift 2
      ;;
    -r|--release-name)
      RELEASE_NAME="$2"
      shift 2
      ;;
    -v|--version)
      VERSION="$2"
      shift 2
      ;;
    -d|--demo)
      DEMO_MODE=true
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      show_help
      exit 1
      ;;
  esac
done

echo -e "${GREEN}=== ARK n8n Custom Nodes Installer ===${NC}\n"

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v kubectl &> /dev/null; then
  echo -e "${RED}Error: kubectl not found. Please install kubectl first.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ kubectl found${NC}"

if ! command -v helm &> /dev/null; then
  echo -e "${RED}Error: helm not found. Please install Helm 3.x first.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ helm found${NC}"

# Check cluster connectivity
if ! kubectl cluster-info &> /dev/null; then
  echo -e "${RED}Error: Cannot connect to Kubernetes cluster. Please configure kubectl.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Connected to Kubernetes cluster${NC}\n"

# Auto-detect ARK API URL if not provided
if [ -z "$ARK_API_URL" ]; then
  echo -e "${YELLOW}Auto-detecting ARK API URL...${NC}"

  # Try common ARK API service names
  ARK_SERVICES=("ark-api" "ark" "ark-gateway")
  ARK_NAMESPACES=("default" "ark-system" "ark")

  for ns in "${ARK_NAMESPACES[@]}"; do
    for svc in "${ARK_SERVICES[@]}"; do
      if kubectl get svc "$svc" -n "$ns" &> /dev/null; then
        ARK_API_URL="http://${svc}.${ns}.svc.cluster.local:80"
        echo -e "${GREEN}✓ Found ARK API: $ARK_API_URL${NC}"
        break 2
      fi
    done
  done

  if [ -z "$ARK_API_URL" ]; then
    echo -e "${YELLOW}Warning: Could not auto-detect ARK API. Using default URL.${NC}"
    ARK_API_URL="http://ark-api.default.svc.cluster.local:80"
  fi
fi

echo -e "\n${GREEN}Installation Configuration:${NC}"
echo -e "  Namespace:     ${NAMESPACE}"
echo -e "  Release Name:  ${RELEASE_NAME}"
echo -e "  Version:       ${VERSION}"
echo -e "  ARK API URL:   ${ARK_API_URL}"
if [ "$DEMO_MODE" = true ]; then
  echo -e "  ${YELLOW}Demo Mode:     ENABLED (NO AUTHENTICATION)${NC}"
fi
echo ""

# Create namespace if it doesn't exist
if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
  echo -e "${YELLOW}Creating namespace: $NAMESPACE${NC}"
  kubectl create namespace "$NAMESPACE"
fi

# Build helm install command
HELM_CMD="helm install $RELEASE_NAME oci://ghcr.io/skokaina/charts/ark-n8n"

if [ "$VERSION" != "latest" ]; then
  HELM_CMD="$HELM_CMD --version $VERSION"
fi

HELM_CMD="$HELM_CMD --namespace $NAMESPACE --set ark.apiUrl=$ARK_API_URL"

# Add demo mode flag if enabled
if [ "$DEMO_MODE" = true ]; then
  echo -e "${YELLOW}⚠️  WARNING: Demo mode disables authentication!${NC}"
  echo -e "${YELLOW}   Only use in secure, non-production environments.${NC}\n"
  HELM_CMD="$HELM_CMD --set app.env.N8N_BASIC_AUTH_ACTIVE=false --set app.env.N8N_USER_MANAGEMENT_DISABLED=true"
fi

# Install
echo -e "${YELLOW}Installing ARK n8n...${NC}"
echo -e "${YELLOW}Running: $HELM_CMD${NC}\n"

if eval "$HELM_CMD"; then
  echo -e "\n${GREEN}✓ Installation successful!${NC}\n"
else
  echo -e "\n${RED}✗ Installation failed. Please check the error messages above.${NC}"
  exit 1
fi

# Wait for deployment to be ready
echo -e "${YELLOW}Waiting for n8n to be ready...${NC}"
kubectl wait --for=condition=available --timeout=300s \
  deployment/$RELEASE_NAME -n $NAMESPACE || {
  echo -e "${YELLOW}Warning: Deployment not ready after 5 minutes. Checking status...${NC}"
  kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=ark-n8n
}

# Get access information
echo -e "\n${GREEN}=== Access Information ===${NC}\n"

# Check for HTTPRoute/Ingress
if kubectl get httproute -n $NAMESPACE &> /dev/null 2>&1; then
  HOSTNAME=$(kubectl get httproute -n $NAMESPACE -o jsonpath='{.items[0].spec.hostnames[0]}' 2>/dev/null || echo "")
  if [ -n "$HOSTNAME" ]; then
    echo -e "${GREEN}n8n UI (via Gateway):${NC} http://$HOSTNAME"
  fi
fi

# Port-forward option
echo -e "${GREEN}n8n UI (via port-forward):${NC}"
echo -e "  Run: kubectl port-forward svc/$RELEASE_NAME 5678:5678 -n $NAMESPACE"
echo -e "  Then open: http://localhost:5678\n"

# Next steps
echo -e "${GREEN}=== Next Steps ===${NC}\n"
echo -e "1. Access n8n UI using one of the methods above"
echo -e "2. Go to: Settings → Credentials → Add Credential → ARK API"
echo -e "3. Configure ARK API URL: $ARK_API_URL"
echo -e "4. Import sample workflows from:"
echo -e "   https://github.com/skokaina/ark-n8n-custom-nodes/tree/main/samples/n8n-workflows\n"

echo -e "${GREEN}Installation complete! 🎉${NC}\n"
