# n8n MCP Server 🔧

MCP (Model Context Protocol) server that exposes n8n AI tools to ARK agents.

## Overview

This server discovers n8n AI tools dynamically and exposes them via the [Model Context Protocol](https://modelcontextprotocol.io/), allowing ARK agents to use n8n tools seamlessly.

**Built with**: [FastMCP](https://github.com/jlowin/fastmcp) - The fastest way to build MCP servers in Python

## Architecture

```
┌──────────────────────────────────────┐
│         n8n Pod (Helm Chart)         │
│                                      │
│  ┌────────────┐  ┌───────────────┐  │
│  │ n8n Main   │  │ MCP Server    │  │
│  │ Container  │  │ (Sidecar)     │  │
│  │            │  │               │  │
│  │ Workflows  │  │ FastMCP       │  │
│  │ AI Tools   │  │ HTTP /mcp     │  │
│  └────────────┘  └───────────────┘  │
│                         │            │
│  Shared Volume:         │            │
│  /tmp/tools/tools.json  │            │
└─────────────────────────┼────────────┘
                          │
                 ClusterIP Service
                 (ark-n8n-mcp:8000)
                          │
┌─────────────────────────┼────────────┐
│         ARK Cluster     │            │
│                         ▼            │
│  ┌────────────────────────────────┐ │
│  │  MCPServer CRD                 │ │
│  │  name: n8n-tools               │ │
│  │  address: ark-n8n-mcp:8000/mcp │ │
│  └────────────────────────────────┘ │
│                                     │
│  ┌────────────────────────────────┐ │
│  │  Agent CRD                     │ │
│  │  tools:                        │ │
│  │    - mcpServerRef: n8n-tools   │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Quick Start

### Local Development

```bash
# Install dependencies
uv pip install -e .

# Run server
python -m src.main
```

Server runs on: `http://localhost:8000/mcp`

### Docker

```bash
# Build
docker build -t n8n-mcp-server:latest .

# Run
docker run -p 8000:8000 \
  -v /tmp/tools:/tmp/tools \
  n8n-mcp-server:latest
```

### Kubernetes (Sidecar)

See `chart/templates/deployment.yaml` for Helm chart integration.

## Tool Discovery

The MCP server discovers n8n tools via **shared volume**:

1. n8n writes tool metadata to `/tmp/tools/tools.json`
2. MCP server reads and exposes tools
3. ARK agents discover tools via MCP protocol

**Tool Metadata Format**:

```json
{
  "tools": [
    {
      "name": "calculator",
      "description": "Perform mathematical calculations",
      "schema": {
        "type": "object",
        "properties": {
          "expression": {
            "type": "string",
            "description": "Math expression to evaluate"
          }
        },
        "required": ["expression"]
      },
      "workflowId": "workflow-123",
      "nodeId": "node-456"
    }
  ],
  "lastUpdated": "2026-02-10T12:00:00Z"
}
```

## Tool Execution Flow

```
1. ARK Agent queries MCP server (tools/list)
   ↓
2. MCP Server returns available n8n tools
   ↓
3. ARK Agent calls tool (tools/call)
   ↓
4. MCP Server executes n8n tool
   ↓
5. Result returned to ARK Agent
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TOOLS_SHARED_PATH` | `/tmp/tools` | Path to shared volume with tool metadata |
| `N8N_INTERNAL_URL` | `http://localhost:5678` | n8n internal API URL |
| `PORT` | `8000` | MCP server port |

## Testing

```bash
# Install dev dependencies
uv pip install -e ".[dev]"

# Run tests
pytest

# Test MCP server manually
curl http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'
```

## ARK Integration

### 1. Deploy MCPServer CRD

```bash
kubectl apply -f deployment/mcpserver.yaml
```

### 2. Create Agent with MCP Tools

```bash
kubectl apply -f deployment/agent-sample.yaml
```

### 3. Test Agent

```yaml
apiVersion: ark.mckinsey.com/v1alpha1
kind: Query
metadata:
  name: test-calculator
spec:
  input: "What is 25 * 42?"
  targets:
    - type: agent
      name: n8n-calculator-agent
  wait: true
```

Expected output:
```
The answer to 25 * 42 is 1,050.
```

## Current Status

**Phase 1 (MVP)**: ✅ Complete
- FastMCP server with demo tools
- HTTP transport on `/mcp` endpoint
- Docker containerization
- ARK MCPServer CRD

**Phase 2 (Coming Soon)**:
- Dynamic tool discovery from n8n
- Actual n8n tool execution (HTTP calls)
- Tool metadata watcher (auto-reload)

## Demo Tools

For testing without n8n integration:

- **calculator**: Evaluate mathematical expressions
- **word_count**: Count words in text

These will be replaced with dynamically discovered n8n tools in production.

## References

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [FastMCP Documentation](https://github.com/jlowin/fastmcp)
- [ARK Documentation](https://mckinsey.github.io/agents-at-scale-ark/)
- [n8n AI Tools](https://docs.n8n.io/advanced-ai/langchain/langchain-n8n/)
