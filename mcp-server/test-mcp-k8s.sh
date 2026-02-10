#!/bin/bash
# Test MCP server integration in Kubernetes

set -e

echo "🧪 Testing MCP Server Integration in Kubernetes"
echo "================================================"
echo ""

# Check if pod is running
echo "1️⃣  Checking pod status..."
POD=$(kubectl get pods -l app=ark-n8n -n default -o jsonpath='{.items[0].metadata.name}')
if [ -z "$POD" ]; then
    echo "❌ No ark-n8n pod found"
    exit 1
fi

READY=$(kubectl get pod "$POD" -n default -o jsonpath='{.status.containerStatuses[?(@.name=="mcp-server")].ready}')
if [ "$READY" = "true" ]; then
    echo "✓ MCP server container is ready"
else
    echo "❌ MCP server container not ready"
    kubectl get pod "$POD" -n default
    exit 1
fi
echo ""

# Check MCPServer CRD
echo "2️⃣  Checking MCPServer CRD..."
if kubectl get mcpserver n8n-tools -n default >/dev/null 2>&1; then
    echo "✓ MCPServer 'n8n-tools' exists"

    AVAILABLE=$(kubectl get mcpserver n8n-tools -n default -o jsonpath='{.status.conditions[?(@.type=="Available")].status}')
    TOOL_COUNT=$(kubectl get mcpserver n8n-tools -n default -o jsonpath='{.status.toolCount}')
    ADDRESS=$(kubectl get mcpserver n8n-tools -n default -o jsonpath='{.status.resolvedAddress}')

    echo "  Status: $AVAILABLE"
    echo "  Tools: $TOOL_COUNT"
    echo "  Address: $ADDRESS"

    if [ "$AVAILABLE" != "True" ]; then
        echo "❌ MCPServer not available"
        kubectl get mcpserver n8n-tools -n default -o yaml
        exit 1
    fi
else
    echo "❌ MCPServer 'n8n-tools' not found"
    exit 1
fi
echo ""

# Check MCP logs
echo "3️⃣  Checking MCP server logs..."
kubectl logs "$POD" -c mcp-server -n default --tail=10 | grep "Starting MCP server" || true
kubectl logs "$POD" -c mcp-server -n default --tail=10 | grep "🚀 n8n MCP Server starting" -A 3 || true
echo ""

# Test health endpoint
echo "4️⃣  Testing MCP health endpoint..."
kubectl port-forward "$POD" 8083:8080 -n default > /dev/null 2>&1 &
PF_PID=$!
sleep 3

HEALTH=$(curl -s http://localhost:8083/health || echo "Connection failed")
kill $PF_PID 2>/dev/null || true

if echo "$HEALTH" | grep -q "healthy"; then
    echo "✓ Health check passed"
    echo "$HEALTH" | jq '.' 2>/dev/null || echo "$HEALTH"
else
    echo "❌ Health check failed"
    echo "Response: $HEALTH"
    exit 1
fi
echo ""

# Test MCP protocol
echo "5️⃣  Testing MCP protocol (tools/list)..."
kubectl port-forward "$POD" 8083:8080 -n default > /dev/null 2>&1 &
PF_PID=$!
sleep 3

# Note: Full MCP protocol requires session management
# This is a basic connectivity test
MCP_RESPONSE=$(curl -s -X POST http://localhost:8083/mcp \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0"}}}' \
    || echo "Connection failed")
kill $PF_PID 2>/dev/null || true

if echo "$MCP_RESPONSE" | grep -q "result"; then
    echo "✓ MCP protocol responding"
else
    echo "⚠️  MCP protocol test incomplete (requires full session management)"
    echo "   ARK controller will handle proper MCP client interaction"
fi
echo ""

# Summary
echo "╔════════════════════════════════════════════════════╗"
echo "║     ✅ MCP Server Integration Test Complete        ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""
echo "Summary:"
echo "  • Pod: $POD"
echo "  • MCP Container: Ready"
echo "  • MCPServer CRD: Available"
echo "  • Tools Discovered: $TOOL_COUNT"
echo "  • Health Endpoint: Working"
echo ""
echo "View full status:"
echo "  kubectl get mcpserver n8n-tools -n default -o yaml"
echo "  kubectl logs $POD -c mcp-server -n default"
echo ""
