#!/bin/bash

# Simple MCP test without session management (for quick testing)

BASE_URL="http://localhost:8080/mcp"

echo "🧪 Simple MCP Test (tools/list)"
echo "================================"

# Try with minimal headers
curl -v $BASE_URL \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'

echo ""
echo "Done!"
