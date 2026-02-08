#!/bin/bash

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  ARK Webhook E2E Test Runner${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# Check if cluster is running
echo -e "${YELLOW}Checking k3d cluster...${NC}"
if ! kubectl cluster-info &> /dev/null; then
  echo -e "${RED}Error: Kubernetes cluster not accessible${NC}"
  echo "Run 'make e2e-setup' to create the test cluster"
  exit 1
fi
echo -e "${GREEN}✓ Cluster is running${NC}"
echo ""

# Check if n8n is running
echo -e "${YELLOW}Checking n8n deployment...${NC}"
if ! kubectl get deployment ark-n8n &> /dev/null; then
  echo -e "${RED}Error: n8n deployment not found${NC}"
  echo "Run 'make e2e-setup' to install n8n"
  exit 1
fi

# Wait for n8n to be ready
kubectl wait --for=condition=available --timeout=60s deployment/ark-n8n || {
  echo -e "${RED}Error: n8n deployment not ready${NC}"
  exit 1
}
echo -e "${GREEN}✓ n8n is running${NC}"
echo ""

# Check if ARK resources exist
echo -e "${YELLOW}Checking ARK resources...${NC}"
if ! kubectl get agent test-agent -n default &> /dev/null; then
  echo -e "${YELLOW}Installing ARK test resources...${NC}"
  kubectl apply -f e2e/fixtures/ark-resources.yaml
  sleep 5
fi
echo -e "${GREEN}✓ ARK resources available${NC}"
echo ""

# Port-forward n8n (if not already forwarded)
echo -e "${YELLOW}Setting up port-forward to n8n...${NC}"
if ! curl -s http://localhost:8080/healthz &> /dev/null; then
  echo "Starting port-forward in background..."
  kubectl port-forward svc/ark-n8n-proxy 8080:80 &
  PORT_FORWARD_PID=$!
  sleep 3

  # Verify port-forward is working
  if ! curl -s http://localhost:8080/healthz &> /dev/null; then
    echo -e "${RED}Error: Port-forward failed${NC}"
    kill $PORT_FORWARD_PID 2>/dev/null || true
    exit 1
  fi
  echo -e "${GREEN}✓ Port-forward active (PID: $PORT_FORWARD_PID)${NC}"
else
  echo -e "${GREEN}✓ Port-forward already active${NC}"
  PORT_FORWARD_PID=""
fi
echo ""

# Run the E2E test
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Running E2E Test${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

cd e2e

# Set environment variables
export N8N_URL=http://localhost:8080
export ARK_API_URL=http://ark-api.ark-system.svc.cluster.local
export CLEANUP_QUERIES=${CLEANUP_QUERIES:-false}

# Run the test
npx playwright test ark-webhook-e2e.spec.ts "$@"
TEST_EXIT_CODE=$?

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"

if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}  ✅ E2E TEST PASSED${NC}"
else
  echo -e "${RED}  ❌ E2E TEST FAILED${NC}"
fi

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# Show Query CRDs
echo -e "${YELLOW}Query CRDs in cluster:${NC}"
kubectl get queries -n default 2>/dev/null || echo "No queries found"
echo ""

# Cleanup port-forward if we started it
if [ -n "$PORT_FORWARD_PID" ]; then
  echo -e "${YELLOW}Stopping port-forward (PID: $PORT_FORWARD_PID)...${NC}"
  kill $PORT_FORWARD_PID 2>/dev/null || true
fi

exit $TEST_EXIT_CODE
