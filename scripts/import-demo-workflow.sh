#!/bin/bash

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

N8N_URL=${N8N_URL:-"http://localhost:8080"}
WORKFLOW_FILE=${1:-"samples/demo-workflows/ark-agent-tool-demo.json"}

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Importing Demo Workflow to n8n                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if workflow file exists
if [ ! -f "$WORKFLOW_FILE" ]; then
    echo -e "${YELLOW}⚠️  Workflow file not found: $WORKFLOW_FILE${NC}"
    exit 1
fi

# Wait for n8n to be ready
echo -e "${BLUE}⏳ Waiting for n8n to be ready...${NC}"
for i in {1..30}; do
    if curl -s "$N8N_URL" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ n8n is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${YELLOW}⚠️  n8n not ready after 30s. Continuing anyway...${NC}"
    fi
    sleep 1
done

# Import workflow via n8n API
echo -e "${BLUE}📥 Importing workflow...${NC}"

# Read workflow JSON
WORKFLOW_JSON=$(cat "$WORKFLOW_FILE")

# Use n8n's REST API to create workflow
# Note: In n8n with auto-login disabled, no API key is needed for local access
RESPONSE=$(curl -s -X POST "$N8N_URL/api/v1/workflows" \
    -H "Content-Type: application/json" \
    -d "$WORKFLOW_JSON" 2>&1)

# Check if successful
if echo "$RESPONSE" | grep -q '"id"'; then
    WORKFLOW_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo -e "${GREEN}✓ Workflow imported successfully${NC}"
    echo -e "${GREEN}  Workflow ID: $WORKFLOW_ID${NC}"
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅ Demo Workflow Ready!${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "Open n8n: ${GREEN}$N8N_URL${NC}"
    echo -e "Workflow: ${GREEN}ARK Agent Tool Demo${NC}"
    echo ""
    echo -e "The workflow will:"
    echo -e "  1️⃣  Prepare a test message"
    echo -e "  2️⃣  Send it to ARK test-agent"
    echo -e "  3️⃣  Format and display the response"
    echo ""
    echo -e "Click ${YELLOW}'Test workflow'${NC} to execute!"
    echo ""
else
    echo -e "${YELLOW}⚠️  Could not import workflow automatically${NC}"
    echo -e "   Response: $RESPONSE"
    echo ""
    echo -e "📋 Manual import instructions:"
    echo -e "  1. Open: ${GREEN}$N8N_URL${NC}"
    echo -e "  2. Click: Workflows → Import from File"
    echo -e "  3. Select: ${GREEN}$WORKFLOW_FILE${NC}"
    echo ""
fi
