#!/bin/bash

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Setting up Ollama and ARK Test Resources${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
  echo -e "${RED}Error: kubectl not found${NC}"
  exit 1
fi

# Check if cluster is accessible
if ! kubectl cluster-info &> /dev/null; then
  echo -e "${RED}Error: Kubernetes cluster not accessible${NC}"
  echo "Run 'make e2e-create' to create the test cluster"
  exit 1
fi

echo -e "${YELLOW}Step 1: Deploying Ollama to cluster...${NC}"
kubectl apply -f e2e/fixtures/ollama-deployment.yaml

echo -e "${YELLOW}Step 2: Waiting for Ollama deployment to be ready...${NC}"
echo "⏳ This may take 5-10 minutes on first run (downloading ~1.5GB image)"
echo "   Subsequent runs will be faster with cached image"
echo ""

# Wait with progress indication
kubectl wait --for=condition=available --timeout=600s deployment/ollama -n ollama || {
  echo -e "${RED}Error: Ollama deployment failed to become ready${NC}"
  echo ""
  echo "Debugging information:"
  kubectl get pods -n ollama
  echo ""
  kubectl describe pod -n ollama -l app=ollama | grep -A 10 "Events:"
  echo ""
  echo "Check full logs: kubectl logs deployment/ollama -n ollama"
  exit 1
}
echo -e "${GREEN}✓ Ollama deployment ready${NC}"

echo -e "${YELLOW}Step 3: Waiting for Ollama service to be ready...${NC}"
sleep 5

# Test Ollama connectivity
echo -e "${YELLOW}Step 4: Testing Ollama connectivity...${NC}"
kubectl run curl-test --image=curlimages/curl:latest --rm -i --restart=Never -- \
  curl -f http://ollama.ollama.svc.cluster.local/api/tags || {
  echo -e "${RED}Error: Cannot connect to Ollama service${NC}"
  exit 1
}
echo -e "${GREEN}✓ Ollama service accessible${NC}"

echo -e "${YELLOW}Step 5: Pulling qwen2.5:0.5b model (smallest model, ~397MB)...${NC}"
echo "This may take a few minutes depending on your internet connection..."

# Create job to pull model
kubectl delete job ollama-pull-model -n ollama --ignore-not-found
kubectl create -f - <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: ollama-pull-model
  namespace: ollama
spec:
  ttlSecondsAfterFinished: 600
  template:
    spec:
      restartPolicy: OnFailure
      containers:
      - name: pull-model
        image: curlimages/curl:latest
        command:
        - sh
        - -c
        - |
          echo "Pulling qwen2.5:0.5b model..."
          curl -X POST http://ollama.ollama.svc.cluster.local/api/pull \
            -H "Content-Type: application/json" \
            -d '{"name": "qwen2.5:0.5b"}' \
            --max-time 600

          echo "Verifying model is available..."
          curl http://ollama.ollama.svc.cluster.local/api/tags

          echo "Model pull complete!"
EOF

# Wait for job to complete
echo "Waiting for model pull to complete (timeout: 10 minutes)..."
kubectl wait --for=condition=complete --timeout=600s job/ollama-pull-model -n ollama || {
  echo -e "${RED}Error: Model pull job failed${NC}"
  echo "Check logs: kubectl logs job/ollama-pull-model -n ollama"
  exit 1
}
echo -e "${GREEN}✓ Model pulled successfully${NC}"

# Verify model is available
echo -e "${YELLOW}Step 6: Verifying model availability...${NC}"
MODELS=$(kubectl run curl-test --image=curlimages/curl:latest --rm -i --restart=Never -- \
  curl -s http://ollama.ollama.svc.cluster.local/api/tags)

if echo "$MODELS" | grep -q "qwen2.5:0.5b"; then
  echo -e "${GREEN}✓ qwen2.5:0.5b model available${NC}"
else
  echo -e "${RED}Error: Model not found in Ollama${NC}"
  echo "Available models: $MODELS"
  exit 1
fi

# Test model with a simple query
echo -e "${YELLOW}Step 7: Testing model with sample query...${NC}"
kubectl run curl-test --image=curlimages/curl:latest --rm -i --restart=Never -- \
  curl -s -X POST http://ollama.ollama.svc.cluster.local/api/generate \
    -H "Content-Type: application/json" \
    -d '{
      "model": "qwen2.5:0.5b",
      "prompt": "What is 2+2?",
      "stream": false
    }' | grep -q "response" && echo -e "${GREEN}✓ Model responding correctly${NC}" || {
  echo -e "${RED}Error: Model test query failed${NC}"
  exit 1
}

echo ""
echo -e "${YELLOW}Step 8: Creating ARK test resources (Model, Agents, Team, Memory, Evaluator)...${NC}"

# Delete existing resources if they exist (for idempotency)
kubectl delete -f e2e/fixtures/ark-test-resources.yaml --ignore-not-found 2>/dev/null || true
sleep 2

# Apply ARK resources
kubectl apply -f e2e/fixtures/ark-test-resources.yaml

echo -e "${GREEN}✓ ARK test resources created${NC}"

# Wait for resources to be ready
echo -e "${YELLOW}Step 9: Verifying ARK resources...${NC}"
sleep 3

# Check model
if kubectl get model test-model -n default &> /dev/null; then
  echo -e "${GREEN}✓ Model 'test-model' created${NC}"
else
  echo -e "${RED}✗ Model 'test-model' not found${NC}"
fi

# Check default model
if kubectl get model default -n default &> /dev/null; then
  echo -e "${GREEN}✓ Model 'default' created${NC}"
else
  echo -e "${RED}✗ Model 'default' not found${NC}"
fi

# Check agents
if kubectl get agent test-agent -n default &> /dev/null; then
  echo -e "${GREEN}✓ Agent 'test-agent' created${NC}"
else
  echo -e "${RED}✗ Agent 'test-agent' not found${NC}"
fi

if kubectl get agent math-agent -n default &> /dev/null; then
  echo -e "${GREEN}✓ Agent 'math-agent' created${NC}"
else
  echo -e "${RED}✗ Agent 'math-agent' not found${NC}"
fi

# Check team
if kubectl get team test-team -n default &> /dev/null; then
  echo -e "${GREEN}✓ Team 'test-team' created${NC}"
else
  echo -e "${RED}✗ Team 'test-team' not found${NC}"
fi

# Check memory
if kubectl get memory test-memory -n default &> /dev/null; then
  echo -e "${GREEN}✓ Memory 'test-memory' created${NC}"
else
  echo -e "${RED}✗ Memory 'test-memory' not found${NC}"
fi

# Check evaluator
if kubectl get evaluator test-evaluator -n default &> /dev/null; then
  echo -e "${GREEN}✓ Evaluator 'test-evaluator' created${NC}"
else
  echo -e "${RED}✗ Evaluator 'test-evaluator' not found${NC}"
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Ollama and ARK Resources Setup Complete!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Ollama Details:${NC}"
echo "  Namespace: ollama"
echo "  Service: http://ollama.ollama.svc.cluster.local"
echo "  Model: qwen2.5:0.5b (397MB, fast inference)"
echo ""
echo -e "${YELLOW}ARK Resources Created:${NC}"
echo "  Models: test-model, default (both using Ollama)"
echo "  Agents: test-agent, math-agent"
echo "  Team: test-team (sequential orchestration)"
echo "  Memory: test-memory (buffer, 20 messages)"
echo "  Evaluator: test-evaluator"
echo ""
echo -e "${YELLOW}Test Ollama:${NC}"
echo "  kubectl run curl-test --image=curlimages/curl:latest --rm -i --restart=Never -- \\"
echo "    curl -X POST http://ollama.ollama.svc.cluster.local/api/generate \\"
echo "      -H 'Content-Type: application/json' \\"
echo "      -d '{\"model\": \"qwen2.5:0.5b\", \"prompt\": \"Hello!\", \"stream\": false}'"
echo ""
echo -e "${YELLOW}View ARK Resources:${NC}"
echo "  kubectl get models,agents,teams,memories,evaluators -n default"
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
