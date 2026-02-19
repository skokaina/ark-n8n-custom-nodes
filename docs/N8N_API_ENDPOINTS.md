# n8n API Endpoints Used by MCP Server

**Date**: February 10, 2026
**Status**: Current Implementation

## Overview

The MCP server acts as a proxy between ARK agents and n8n AI tools. This document lists all n8n API endpoints used by the MCP server for tool execution and management.

## Architecture Flow

```
ARK Agent
    ↓ (MCP protocol)
MCP Server (mcp-server container)
    ↓ (HTTP requests with X-N8N-API-KEY header)
n8n Server (ark-n8n container)
    ↓ (executes workflow)
Tool Result
```

## Primary Endpoint: Webhook-Based Tool Execution

### 1. Execute Tool via Webhook

**Endpoint**: `POST /webhook/tool/{tool_name}`

**Purpose**: Execute a specific n8n AI tool workflow via webhook trigger

**Authentication**: Required - `X-N8N-API-KEY` header

**Example Request**:
```http
POST http://localhost:5678/webhook/tool/calculator
Content-Type: application/json
X-N8N-API-KEY: n8n_api_xxx

{
  "expression": "2 + 2"
}
```

**Example Response**:
```json
{
  "success": true,
  "result": 4
}
```

**Implementation in MCP Server** (`mcp-server/src/main.py`):
```python
async def execute_n8n_tool(tool_name: str, tool_config: Dict[str, Any], params: Dict[str, Any]) -> Any:
    # Construct endpoint from environment variable + webhook path
    webhook_path = tool_config.get("webhookPath")
    endpoint = f"{N8N_INTERNAL_URL}{webhook_path}"

    # Always add API key header (required)
    headers = {
        "Content-Type": "application/json",
        "X-N8N-API-KEY": N8N_API_KEY
    }

    response = await http_client.post(endpoint, json=params, headers=headers)
    return response.json()
```

**Tool Configuration Example** (`chart/templates/mcp-tools-configmap.yaml`):
```yaml
tools:
  - name: calculator
    description: "Perform mathematical calculations"
    webhookPath: "/webhook/tool/calculator"  # Relative path
    method: "POST"
    schema:
      type: object
      properties:
        expression:
          type: string
          description: "Mathematical expression to evaluate"
      required: ["expression"]
```

### Tool Workflows in n8n

Each tool is implemented as an n8n workflow with:

1. **Webhook Trigger Node**: Listens on `/webhook/tool/{tool_name}`
2. **Processing Logic**: Code node, HTTP Request node, or n8n AI nodes
3. **Respond to Webhook Node**: Returns result in JSON format

**Example Calculator Tool Workflow**:
```
Webhook Trigger (POST /webhook/tool/calculator)
    ↓
Code Node (evaluate expression safely)
    ↓
Respond to Webhook (return { "success": true, "result": result })
```

## Available Tool Endpoints

Based on current implementation and planned tools:

| Tool Name | Webhook Path | Method | Authentication | Status |
|-----------|--------------|--------|----------------|--------|
| **calculator** | `/webhook/tool/calculator` | POST | Required | ✅ Implemented |
| **get_weather** | `/webhook/tool/weather` | POST | Required | ✅ Implemented |
| **web_search** | `/webhook/tool/web_search` | POST | Required | 📋 Planned |
| **http_request** | `/webhook/tool/http_request` | POST | Required | 📋 Planned |
| **code_executor** | `/webhook/tool/code_executor` | POST | Required | 📋 Planned |

## Alternative n8n API Endpoints (NOT Currently Used)

The following n8n REST API endpoints are available but **NOT** currently used by our MCP implementation:

### Workflow Execution API

**Endpoint**: `POST /api/v1/workflows/{workflowId}/execute`

**Purpose**: Execute a workflow programmatically (alternative to webhooks)

**Why Not Used**: Webhook approach is simpler and more stateless. Workflows are already configured with webhook triggers.

**Authentication**: Required - `X-N8N-API-KEY` header

**Example**:
```http
POST http://localhost:5678/api/v1/workflows/123/execute
Content-Type: application/json
X-N8N-API-KEY: n8n_api_xxx

{
  "data": {
    "expression": "2 + 2"
  }
}
```

### Workflow List API

**Endpoint**: `GET /api/v1/workflows`

**Purpose**: List all available workflows (could be used for tool discovery)

**Why Not Used**: Tool registration is static via ConfigMap. Dynamic discovery not implemented yet.

**Authentication**: Required - `X-N8N-API-KEY` header

**Example**:
```http
GET http://localhost:5678/api/v1/workflows
X-N8N-API-KEY: n8n_api_xxx
```

### Execution Status API

**Endpoint**: `GET /api/v1/executions/{executionId}`

**Purpose**: Check status of workflow execution (for async execution)

**Why Not Used**: All tool executions are synchronous (wait for result). Async execution not implemented.

**Authentication**: Required - `X-N8N-API-KEY` header

## Authentication Details

### API Key Header

**Header Name**: `X-N8N-API-KEY`
**Header Value**: `n8n_api_{random_string}` (generated in n8n UI)
**Required**: YES - All endpoints require authentication

### How to Get API Key

1. Open n8n UI → **Settings** (gear icon)
2. Go to **API** tab
3. Click **Create API Key**
4. Label it: "MCP Server"
5. Copy the key (starts with `n8n_api_`)

### Environment Variable

The API key is stored in Kubernetes Secret and injected as environment variable:

```bash
# Create secret
kubectl create secret generic n8n-api-key \
  --from-literal=api-key="n8n_api_actual_key_here"

# Reference in deployment
env:
  - name: N8N_API_KEY
    valueFrom:
      secretKeyRef:
        name: n8n-api-key
        key: api-key
        optional: false  # REQUIRED
```

### MCP Server Validation

The MCP server validates API key presence at startup:

```python
N8N_API_KEY = os.getenv("N8N_API_KEY")
if not N8N_API_KEY:
    raise ValueError(
        "❌ FATAL: N8N_API_KEY environment variable is required but not set.\n"
        "   n8n requires API key authentication for all tool endpoints."
    )
```

## Request/Response Format

### Standard Request Format

All tool webhooks follow this pattern:

```http
POST /webhook/tool/{tool_name}
Content-Type: application/json
X-N8N-API-KEY: n8n_api_xxx

{
  "param1": "value1",
  "param2": "value2"
}
```

### Standard Response Format

All tool webhooks return JSON:

```json
{
  "success": true,
  "result": <tool_specific_result>,
  "error": null
}
```

**Error Response**:
```json
{
  "success": false,
  "result": null,
  "error": "Error message here"
}
```

## Environment Configuration

### MCP Server Environment Variables

```bash
# Base URL for n8n (configurable per environment)
N8N_INTERNAL_URL=http://localhost:5678

# API key (REQUIRED - from Kubernetes Secret)
N8N_API_KEY=n8n_api_xxx

# Other config
TOOLS_SHARED_PATH=/tmp/tools
PORT=8080
```

### Helm Configuration

```yaml
# chart/values.yaml
mcp:
  enabled: true
  n8nUrl: "http://localhost:5678"  # Base URL for webhooks

n8nApiKey:
  existingSecret: "n8n-api-key"  # Reference to secret
```

### URL Construction

URLs are constructed at runtime (not hardcoded):

```python
# ConfigMap contains only relative path
webhookPath = "/webhook/tool/calculator"

# MCP server constructs full URL
N8N_INTERNAL_URL = os.getenv("N8N_INTERNAL_URL")  # http://localhost:5678
endpoint = f"{N8N_INTERNAL_URL}{webhookPath}"     # http://localhost:5678/webhook/tool/calculator
```

## Error Handling

### HTTP Status Codes

| Status Code | Meaning | MCP Server Action |
|-------------|---------|-------------------|
| 200 OK | Tool executed successfully | Return result to ARK agent |
| 401 Unauthorized | Invalid/missing API key | Log error, return error to agent |
| 404 Not Found | Tool webhook not found | Log error, return error to agent |
| 500 Internal Server Error | Tool execution failed | Log error, return error to agent |

### MCP Server Error Handling

```python
try:
    response = await http_client.post(endpoint, json=params, headers=headers)
    response.raise_for_status()
    result = response.json()
    return result
except httpx.HTTPStatusError as e:
    error_msg = f"Tool execution failed: {e.response.status_code} - {e.response.text}"
    print(f"❌ {error_msg}")
    return {"error": error_msg, "success": False}
except Exception as e:
    error_msg = f"Tool execution error: {str(e)}"
    print(f"❌ {error_msg}")
    return {"error": error_msg, "success": False}
```

## Security Considerations

### 1. API Key Security

- ✅ Stored in Kubernetes Secret (not ConfigMap)
- ✅ Never logged in plaintext
- ✅ Required for all endpoints
- ✅ Injected as environment variable (not in code)

### 2. Network Security

- ✅ MCP ↔ n8n communication is internal (ClusterIP service)
- ✅ No external exposure of tool webhooks
- ✅ TLS can be enabled via Ingress/Gateway

### 3. Input Validation

- ⚠️ n8n workflows should validate tool parameters
- ⚠️ Use Code node sandbox for safe expression evaluation
- ⚠️ Implement rate limiting if needed

## Testing Endpoints

### Test Tool Execution

```bash
# Port-forward to n8n
kubectl port-forward svc/ark-n8n 5678:5678

# Get API key from secret
API_KEY=$(kubectl get secret n8n-api-key -o jsonpath='{.data.api-key}' | base64 -d)

# Test calculator tool
curl -X POST http://localhost:5678/webhook/tool/calculator \
  -H "Content-Type: application/json" \
  -H "X-N8N-API-KEY: $API_KEY" \
  -d '{"expression": "2 + 2"}'

# Expected response
# {"success": true, "result": 4}
```

### Test MCP Server

```bash
# Port-forward to MCP server
kubectl port-forward svc/ark-n8n 8080:8080

# Check health
curl http://localhost:8080/health

# MCP server will use N8N_API_KEY internally when calling n8n webhooks
```

## Future Enhancements

### 1. Dynamic Tool Discovery

Instead of static ConfigMap, discover tools from n8n API:

```python
# Potential implementation
async def discover_n8n_tools():
    response = await http_client.get(
        f"{N8N_INTERNAL_URL}/api/v1/workflows",
        headers={"X-N8N-API-KEY": N8N_API_KEY}
    )
    workflows = response.json()

    # Filter workflows with "tool" tag
    tools = [w for w in workflows if "tool" in w.get("tags", [])]
    return tools
```

### 2. Async Tool Execution

For long-running tools, use async execution:

```python
# POST /api/v1/workflows/{id}/execute with waitForCompletion=false
# GET /api/v1/executions/{id} to poll for result
```

### 3. Tool Categories

Organize tools by category using n8n tags:

- `tool:math` - Calculator, statistics
- `tool:data` - HTTP requests, database queries
- `tool:ai` - LLM calls, embeddings

## Summary

### Currently Used Endpoints

1. ✅ `POST /webhook/tool/{tool_name}` - Primary tool execution (ALL tools)

### Endpoints Requiring Authentication

- ✅ ALL endpoints require `X-N8N-API-KEY` header
- ✅ API key is mandatory (MCP server validates at startup)

### Configuration

- ✅ Base URL: `N8N_INTERNAL_URL` environment variable
- ✅ API Key: `N8N_API_KEY` environment variable (from Kubernetes Secret)
- ✅ Tool paths: ConfigMap with relative webhook paths

---

**Security**: ✅ All endpoints require API key authentication
**Flexibility**: ✅ Environment-driven URL configuration
**Production Ready**: ✅ Kubernetes Secret integration
**Documentation**: ✅ Complete with examples
