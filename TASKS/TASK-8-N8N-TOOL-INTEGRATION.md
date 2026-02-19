# Task #8: n8n AI Tools Integration with MCP Server

**Status**: 🚧 In Progress
**Started**: February 10, 2026
**Assignee**: Claude Sonnet 4.5

## Overview

Replace demo tools in the MCP server with actual n8n AI tools, enabling ARK agents to use n8n's rich ecosystem of integrations.

## Current State

✅ **Completed**:
- MCP server deployed as sidecar in n8n pod
- MCPServer CRD registered with ARK (`n8n-tools`)
- 2 demo tools working (calculator, word_count)
- E2E testing infrastructure in place
- Shared volume between n8n and MCP server (`/tmp/tools`)

📍 **Current Gap**:
- Demo tools use local evaluation (security risk)
- No connection to actual n8n workflows
- No dynamic tool discovery from n8n
- No tool execution bridge to n8n API

## Architecture

```
┌─────────────────────────────────────────────┐
│  n8n Pod                                    │
│                                             │
│  ┌──────────────┐      ┌─────────────────┐│
│  │ n8n Main     │      │ MCP Server      ││
│  │              │      │                 ││
│  │ - Workflows  │◄─────┤ - Tool Discovery││
│  │ - AI Tools   │      │ - Tool Registry ││
│  │ - Webhooks   │◄─────┤ - Execution     ││
│  │              │      │   Bridge        ││
│  └──────────────┘      └─────────────────┘│
│         │                      ▲           │
│         │ /tmp/tools/          │           │
│         │ tools.json           │           │
│         ▼                      │           │
│  [Shared Volume]───────────────┘           │
└─────────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: n8n Tool Exporter

**Objective**: Create a mechanism for n8n to export its available AI tools to the shared volume.

**Options**:

#### Option A: Webhook-based Tool Export (Recommended)
Create a special n8n workflow that exposes available tools via webhook:

```
Workflow: "Tool Registry"
[Webhook Trigger: GET /tools]
  ↓
[Function Node: List Available Tools]
  - Scan workflows for @n8n-nodes-langchain tools
  - Extract tool metadata (name, description, schema)
  - Return as JSON
```

#### Option B: Startup Script
Add a script to n8n container that exports tools on startup:

```bash
#!/bin/bash
# In n8n Dockerfile/entrypoint
node /opt/export-tools.js > /tmp/tools/tools.json
n8n start
```

#### Option C: File Watcher + API Polling
MCP server polls n8n API periodically to discover tools:

```python
# In MCP server
async def refresh_tools():
    response = requests.get("http://localhost:5678/api/v1/workflows")
    tools = extract_tools_from_workflows(response.json())
    save_tools("/tmp/tools/tools.json", tools)
```

**Decision**: Start with **Option A** (webhook) for simplicity, move to Option C for production.

### Step 2: Tool Metadata Format

Define the `/tmp/tools/tools.json` format:

```json
{
  "tools": [
    {
      "name": "web_search",
      "description": "Search the web for information",
      "schema": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "Search query"
          }
        },
        "required": ["query"]
      },
      "executionEndpoint": "http://localhost:5678/webhook/tool/web_search",
      "method": "POST"
    }
  ],
  "lastUpdated": "2026-02-10T12:00:00Z"
}
```

### Step 3: MCP Server - Tool Execution Bridge

Update `mcp-server/src/main.py` to forward tool calls to n8n:

```python
import httpx

async def execute_n8n_tool(tool_name: str, parameters: dict) -> str:
    """Execute tool via n8n webhook."""
    tool = next(t for t in n8n_tools if t['name'] == tool_name)
    endpoint = tool['executionEndpoint']

    async with httpx.AsyncClient() as client:
        response = await client.post(
            endpoint,
            json=parameters,
            timeout=30.0
        )
        response.raise_for_status()
        return response.text

@mcp.tool
async def dynamic_tool(tool_name: Annotated[str, "Tool to execute"],
                      **kwargs) -> str:
    """Dynamically route tool calls to n8n."""
    return await execute_n8n_tool(tool_name, kwargs)
```

### Step 4: Dynamic Tool Registration

Update MCP server to register tools dynamically:

```python
def register_n8n_tools():
    """Register n8n tools with FastMCP."""
    for tool in n8n_tools:
        # Create a closure to capture tool metadata
        def make_tool_function(tool_meta):
            async def tool_func(**kwargs):
                return await execute_n8n_tool(tool_meta['name'], kwargs)
            tool_func.__name__ = tool_meta['name']
            tool_func.__doc__ = tool_meta['description']
            return tool_func

        # Register with MCP
        mcp.tool(make_tool_function(tool))
```

### Step 5: n8n Tool Workflows

Create sample n8n workflows that serve as tools:

#### Workflow 1: Web Search Tool
```
[Webhook: POST /webhook/tool/web_search]
  ↓
[HTTP Request: Serper API]
  ↓
[Function: Format Results]
  ↓
[Respond to Webhook]
```

#### Workflow 2: Calculator Tool
```
[Webhook: POST /webhook/tool/calculator]
  ↓
[Code Node: Evaluate Expression]
  ↓
[Respond to Webhook]
```

#### Workflow 3: Weather Tool
```
[Webhook: POST /webhook/tool/get_weather]
  ↓
[HTTP Request: OpenWeather API]
  ↓
[Function: Format Weather Data]
  ↓
[Respond to Webhook]
```

### Step 6: E2E Testing

Create comprehensive E2E tests:

#### Test 1: Tool Discovery
```bash
# Verify MCP server discovers n8n tools
kubectl exec -it deployment/ark-n8n -c mcp-server -- cat /tmp/tools/tools.json
# Should show real n8n tools, not demo tools
```

#### Test 2: Tool Execution via MCP
```bash
# Test tool call via MCP protocol
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "id": 1,
    "params": {
      "name": "web_search",
      "arguments": {"query": "kubernetes best practices"}
    }
  }'
```

#### Test 3: ARK Agent Using n8n Tool
```yaml
apiVersion: ark.mckinsey.com/v1alpha1
kind: Query
metadata:
  name: test-web-search
spec:
  input: "Search for information about Claude AI"
  target:
    type: agent
    name: test-agent
  timeout: 60s
```

## Implementation Checklist

- [ ] **Step 1**: Create n8n Tool Registry workflow
  - [ ] Webhook endpoint for tool list
  - [ ] Function to extract tool metadata
  - [ ] Export to `/tmp/tools/tools.json`

- [ ] **Step 2**: Update MCP server for dynamic tools
  - [ ] Remove hardcoded demo tools
  - [ ] Implement tool discovery from JSON file
  - [ ] Implement HTTP client for n8n webhooks
  - [ ] Dynamic tool registration with FastMCP

- [ ] **Step 3**: Create sample n8n tool workflows
  - [ ] Web Search tool (using Serper or Google API)
  - [ ] Calculator tool (safe evaluation)
  - [ ] Weather tool (OpenWeather API)

- [ ] **Step 4**: Update Helm chart
  - [ ] Ensure shared volume is mounted
  - [ ] Add n8n webhook URLs to MCP env vars
  - [ ] Configure tool refresh interval

- [ ] **Step 5**: E2E Testing
  - [ ] Test tool discovery
  - [ ] Test tool execution via MCP
  - [ ] Test ARK agent using n8n tools
  - [ ] Add Playwright test for full workflow

- [ ] **Step 6**: Documentation
  - [ ] Update MCP_INTEGRATION_STATUS.md
  - [ ] Create guide for adding new n8n tools
  - [ ] Document tool webhook format
  - [ ] Add troubleshooting section

## Success Criteria

✅ **Functional**:
- MCP server discovers n8n tools automatically
- ARK agents can call n8n tools via MCP
- Tool execution results are returned correctly
- At least 3 real n8n tools working (web search, calculator, weather)

✅ **Performance**:
- Tool discovery completes in <5s
- Tool execution completes in <10s
- MCP server handles 10+ concurrent tool calls

✅ **Testing**:
- E2E test covers ARK → MCP → n8n → result flow
- All 3 sample tools have test coverage
- CI/CD passes with real tools

✅ **Documentation**:
- README updated with tool integration guide
- Architecture diagrams show real tool flow
- Troubleshooting guide includes common issues

## Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Planning & Design | 1 day | ✅ Complete |
| n8n Tool Exporter | 2 days | 🚧 In Progress |
| MCP Dynamic Tools | 2 days | ⏳ Pending |
| Sample Workflows | 1 day | ⏳ Pending |
| E2E Testing | 2 days | ⏳ Pending |
| Documentation | 1 day | ⏳ Pending |
| **Total** | **9 days** | **11% Complete** |

## Technical Decisions

### Decision 1: Tool Discovery Method

**Options**:
- A) Webhook-based (n8n serves tool list)
- B) File-based (n8n writes to shared volume)
- C) API-based (MCP polls n8n API)

**Choice**: Start with **A** (webhook), transition to **C** for production

**Rationale**:
- Webhook is simplest to implement and test
- API polling is more robust for production (no shared volume issues)
- File-based is fallback if networking issues occur

### Decision 2: Tool Execution Pattern

**Options**:
- A) Direct n8n API calls
- B) Webhook-based execution
- C) Workflow execution API

**Choice**: **B** (webhook-based)

**Rationale**:
- Webhooks are stateless and scalable
- Each tool is a self-contained n8n workflow
- Easy to add authentication and rate limiting
- Consistent with n8n's webhook-first design

### Decision 3: Tool Schema Format

**Options**:
- A) OpenAPI/Swagger
- B) JSON Schema
- C) MCP native format

**Choice**: **B** (JSON Schema)

**Rationale**:
- MCP uses JSON Schema for tool parameters
- n8n tools already use JSON Schema internally
- No conversion needed

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| n8n webhook authentication | High | Use n8n internal API or shared secret |
| Tool execution timeout | Medium | Configure 30s timeout, add retry logic |
| Tool discovery failures | Medium | Fallback to cached tool list |
| Schema mismatches | Low | Validate schemas on tool registration |
| Concurrent tool calls | Low | Use async HTTP client with connection pooling |

## Follow-up Tasks

After completing this task:

1. **Task #9**: Add more n8n tools (HTTP Request, Code, Database)
2. **Task #10**: Implement tool caching and performance optimization
3. **Task #11**: Add tool analytics and monitoring
4. **Task #12**: Create tool marketplace/template library

## References

- [MCP Protocol Spec](https://modelcontextprotocol.io/docs/specification/basic/prompts)
- [FastMCP Documentation](https://gofastmcp.com)
- [n8n Webhook Documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- [docs/MCP_INTEGRATION_STATUS.md](../docs/MCP_INTEGRATION_STATUS.md)

---
**Last Updated**: February 10, 2026
**Next Review**: Step 1 completion
