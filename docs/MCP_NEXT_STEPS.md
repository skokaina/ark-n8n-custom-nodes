# MCP Server - Next Implementation Steps

**Status**: 📋 Ready to Implement
**Date**: February 10, 2026

## Current State

✅ **Completed**:
1. MCP server deployed as sidecar with demo tools
2. MCPServer CRD registered with ARK
3. E2E testing infrastructure (`make e2e-ark-n8n-mcp`)
4. Sample n8n tool workflows created (calculator, weather)
5. Tool documentation and guides
6. HTTP client dependency added (`httpx`)

## Next Steps

### Step 1: Update MCP Server for Real Tool Execution

**File**: `mcp-server/src/main.py`

**Changes Needed**:

```python
# Add imports
import httpx
from typing import Dict, Any, Callable

# Update load_n8n_tools() to properly parse tool metadata
def load_n8n_tools() -> list[dict[str, Any]]:
    """Load n8n tools from /tmp/tools/tools.json"""
    tools_file = Path(TOOLS_SHARED_PATH) / "tools.json"

    if not tools_file.exists():
        return get_demo_tools()  # Fallback

    with open(tools_file) as f:
        data = json.load(f)
        return data.get("tools", [])

# Add n8n tool execution function
async def execute_n8n_tool(tool_name: str, tool_config: dict, **kwargs) -> Any:
    """Execute n8n tool via webhook"""
    endpoint = tool_config.get("executionEndpoint", f"{N8N_INTERNAL_URL}/webhook/tool/{tool_name}")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(endpoint, json=kwargs)
        response.raise_for_status()
        return response.json()

# Dynamically register tools
def register_n8n_tools():
    """Register n8n tools dynamically with FastMCP"""
    for tool_config in n8n_tools:
        name = tool_config["name"]
        description = tool_config["description"]
        schema = tool_config.get("schema", {})

        # Create tool function
        async def tool_func(**kwargs):
            return await execute_n8n_tool(name, tool_config, **kwargs)

        # Set metadata
        tool_func.__name__ = name
        tool_func.__doc__ = description

        # Register with MCP
        mcp.tool(tool_func)

# Call during initialization
register_n8n_tools()
```

### Step 2: Create tools.json File

**Location**: In MCP server or as init script

**Option A - Static File**:
```bash
# Create during deployment
cat > /tmp/tools/tools.json <<'EOF'
{
  "tools": [
    {
      "name": "calculator",
      "description": "Perform mathematical calculations",
      "schema": {...},
      "executionEndpoint": "http://localhost:5678/webhook/tool/calculator"
    },
    {
      "name": "get_weather",
      "description": "Get weather information",
      "schema": {...},
      "executionEndpoint": "http://localhost:5678/webhook/tool/weather"
    }
  ]
}
EOF
```

**Option B - Init Container** (Recommended for production):
```yaml
# In deployment.yaml
initContainers:
- name: setup-tools
  image: busybox
  command: ['sh', '-c', 'cp /config/tools.json /tmp/tools/']
  volumeMounts:
  - name: tool-config
    mountPath: /config
  - name: tools-shared
    mountPath: /tmp/tools
```

### Step 3: Import n8n Workflows

**Manual Steps** (for now):

```bash
# 1. Port-forward to n8n
kubectl port-forward svc/ark-n8n-proxy 8080:80

# 2. Open http://localhost:8080 in browser

# 3. Import workflows:
#    - Click "+ Add workflow" → "Import from file"
#    - Import samples/mcp-tools/calculator-tool.json
#    - Import samples/mcp-tools/weather-tool.json

# 4. Activate workflows

# 5. Test webhooks
curl -X POST http://localhost:8080/webhook/tool/calculator \
  -H "Content-Type: application/json" \
  -d '{"expression": "2 + 2"}'
```

**Automated** (future):
- Add init container that imports workflows via n8n API
- Or bundle workflows in Docker image

### Step 4: Deploy Updated MCP Server

```bash
# Rebuild MCP image
cd mcp-server
docker build -t ark-n8n-mcp:latest .

# Update deployment
make e2e-update  # Or helm upgrade

# Verify
make e2e-ark-n8n-mcp
```

### Step 5: Test End-to-End

```bash
# 1. Verify tools are loaded
kubectl logs -l app=ark-n8n -c mcp-server --tail=20
# Should show: "✅ Loaded 2 tools from /tmp/tools/tools.json"

# 2. Test MCP tool call
kubectl port-forward svc/ark-n8n 8082:8080 &
curl -X POST http://localhost:8082/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "id": 1,
    "params": {
      "name": "calculator",
      "arguments": {"expression": "25 * 42"}
    }
  }'

# 3. Test via ARK agent
kubectl apply -f - <<EOF
apiVersion: ark.mckinsey.com/v1alpha1
kind: Query
metadata:
  name: test-calculator-mcp
spec:
  input: "What is 25 multiplied by 42?"
  target:
    type: agent
    name: test-agent
  timeout: 60s
EOF

kubectl get query test-calculator-mcp -w
```

## Implementation Checklist

- [ ] Update `mcp-server/src/main.py`
  - [ ] Add httpx imports
  - [ ] Implement `execute_n8n_tool()` function
  - [ ] Implement `register_n8n_tools()` function
  - [ ] Remove hardcoded demo tools
  - [ ] Add error handling

- [ ] Create `tools.json` deployment mechanism
  - [ ] ConfigMap with tool definitions
  - [ ] Init container to copy to shared volume
  - [ ] Or startup script in MCP container

- [ ] Import n8n workflows
  - [ ] Test locally first
  - [ ] Import via UI or n8n API
  - [ ] Activate workflows

- [ ] Test locally
  - [ ] Rebuild Docker image
  - [ ] Deploy to k3d cluster
  - [ ] Verify tools load correctly
  - [ ] Test tool execution

- [ ] Update E2E tests
  - [ ] Add test for real tool execution
  - [ ] Add test for ARK agent using tools
  - [ ] Update CI/CD pipeline

- [ ] Documentation
  - [ ] Update MCP_INTEGRATION_STATUS.md
  - [ ] Add troubleshooting for tool execution errors
  - [ ] Document how to add new tools

## Timeline Estimate

| Task | Duration | Complexity |
|------|----------|------------|
| Update MCP server code | 2-3 hours | Medium |
| Create tools.json mechanism | 1-2 hours | Low |
| Import n8n workflows | 30 min | Low |
| Testing & debugging | 2-3 hours | Medium |
| Documentation | 1 hour | Low |
| **Total** | **7-10 hours** | **Medium** |

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tool execution timeout | Medium | Add 30s timeout, retry logic |
| n8n webhook auth | High | Use internal networking (localhost) |
| Schema mismatch | Low | Validate schemas on load |
| Tool not found in n8n | Medium | Return friendly error, check workflow is active |

## Success Criteria

✅ **Functional**:
- MCP server loads tools from `/tmp/tools/tools.json`
- Tool calls are forwarded to n8n webhooks
- Results are returned correctly to ARK agents
- At least 2 real tools working (calculator, weather)

✅ **Testing**:
- `make e2e-ark-n8n-mcp` passes
- ARK agent can successfully use n8n tools
- Tool execution completes in <10s

✅ **Documentation**:
- README updated with real tool examples
- Troubleshooting guide covers common issues

## Future Enhancements

After completing basic integration:

1. **Tool Auto-Discovery**: n8n exports tools automatically
2. **Hot Reload**: MCP server reloads tools without restart
3. **Tool Analytics**: Track usage, performance, errors
4. **More Tools**: web_search, http_request, code_interpreter
5. **Production Ready**: Error handling, retries, circuit breakers

## References

- [Task #8 Plan](../TASKS/TASK-8-N8N-TOOL-INTEGRATION.md)
- [MCP Integration Status](MCP_INTEGRATION_STATUS.md)
- [Sample Tool Workflows](../samples/mcp-tools/README.md)
- [E2E Testing Guide](MCP_E2E_TESTING.md)

---
**Status**: Ready for implementation
**Next Action**: Update `mcp-server/src/main.py` with real tool execution
**Estimated Completion**: End of day (7-10 hours work)
