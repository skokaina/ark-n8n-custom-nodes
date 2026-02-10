#!/bin/bash

# Test MCP server endpoints

echo "🧪 Testing n8n MCP Server"
echo "=========================="
echo ""

BASE_URL="http://localhost:8080/mcp"

# Test 1: tools/list
echo "1️⃣  Testing tools/list..."
curl -s $BASE_URL \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }' | python -m json.tool

echo ""
echo ""

# Test 2: tools/call (calculator)
echo "2️⃣  Testing tools/call (calculator: 25 * 42)..."
curl -s $BASE_URL \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "id": 2,
    "params": {
      "name": "calculator",
      "arguments": {
        "expression": "25 * 42"
      }
    }
  }' | python -m json.tool

echo ""
echo ""

# Test 3: tools/call (word_count)
echo "3️⃣  Testing tools/call (word_count)..."
curl -s $BASE_URL \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "id": 3,
    "params": {
      "name": "word_count",
      "arguments": {
        "text": "Hello world from n8n MCP server"
      }
    }
  }' | python -m json.tool

echo ""
echo "✅ Tests complete!"
