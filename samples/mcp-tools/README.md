# MCP Tool Workflows for n8n

This directory contains sample n8n workflows that serve as tools for the ARK MCP server integration.

## Overview

Each workflow exposes a webhook endpoint that the MCP server calls to execute tools. The workflows follow a standard pattern:

```
Webhook → Process Request → Respond
```

## Available Tools

### 1. Calculator Tool

**File**: `calculator-tool.json`
**Webhook**: `POST /webhook/tool/calculator`

Performs safe mathematical calculations.

**Input**:
```json
{
  "expression": "25 * 42"
}
```

**Output**:
```json
{
  "result": 1050,
  "expression": "25 * 42",
  "success": true
}
```

**Features**:
- Safe evaluation (no `eval()`)
- Input sanitization
- Error handling

### 2. Weather Tool

**File**: `weather-tool.json`
**Webhook**: `POST /webhook/tool/weather`

Gets weather information for a location (mock data for demo).

**Input**:
```json
{
  "location": "New York"
}
```

**Output**:
```json
{
  "location": "New York",
  "temperature": 18,
  "temperature_unit": "celsius",
  "condition": "Partly Cloudy",
  "humidity": 65,
  "success": true
}
```

**Note**: Uses mock data. Set `OPENWEATHER_API_KEY` env var for real weather data.

## Installation

### Method 1: Manual Import (Recommended)

1. Access n8n UI:
   ```bash
   kubectl port-forward svc/ark-n8n-proxy 8080:80
   # Open http://localhost:8080
   ```

2. Import each workflow:
   - Click "+ Add workflow" → "Import from file"
   - Select `calculator-tool.json`
   - Click "Save" and "Activate"
   - Repeat for `weather-tool.json`

3. Verify webhooks are active:
   - Go to "Workflows" tab
   - Check that both workflows show "Active"
   - Note the webhook URLs

### Method 2: CLI Import

```bash
# Copy JSON files to n8n pod
kubectl cp calculator-tool.json default/ark-n8n:/tmp/

# Import via n8n CLI (inside pod)
kubectl exec -it deployment/ark-n8n -- n8n import:workflow --input=/tmp/calculator-tool.json
```

### Method 3: Automated Deployment

Add to Helm chart as ConfigMap and import on startup:

```yaml
# In chart/templates/tool-workflows-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mcp-tool-workflows
data:
  calculator-tool.json: |
    {{ .Files.Get "samples/mcp-tools/calculator-tool.json" | indent 4 }}
  weather-tool.json: |
    {{ .Files.Get "samples/mcp-tools/weather-tool.json" | indent 4 }}
```

## Testing

### Test Calculator Tool

```bash
# Port-forward to n8n
kubectl port-forward svc/ark-n8n 5678:5678 &

# Test calculator
curl -X POST http://localhost:5678/webhook/tool/calculator \
  -H "Content-Type: application/json" \
  -d '{"expression": "25 * 42"}'

# Expected: {"result":1050,"expression":"25 * 42","success":true}
```

### Test Weather Tool

```bash
curl -X POST http://localhost:5678/webhook/tool/weather \
  -H "Content-Type: application/json" \
  -d '{"location": "New York"}'

# Expected: {"location":"New York","temperature":18,...}
```

## Tool Registry

The tool registry is now managed via Helm ConfigMap. Tools are defined with **webhook paths** (not full URLs) and the base n8n URL is configured via environment variable.

### Configuration

**In `chart/values.yaml`**:
```yaml
mcp:
  enabled: true
  n8nUrl: "http://localhost:5678"  # Configure per environment
```

**In tool definitions** (ConfigMap):
```json
{
  "tools": [
    {
      "name": "calculator",
      "description": "Perform mathematical calculations",
      "schema": {...},
      "webhookPath": "/webhook/tool/calculator",  # ✅ Relative path
      "method": "POST"
    }
  ]
}
```

**Backwards compatible** (legacy format still supported):
```json
{
  "tools": [
    {
      "name": "external_api",
      "description": "Call external API",
      "schema": {...},
      "executionEndpoint": "https://api.example.com/tool",  # ✅ Full URL
      "method": "POST"
    }
  ]
}
```

### Environment Variables

The MCP server reads n8n URL from:
```bash
N8N_INTERNAL_URL=http://localhost:5678  # Set via Helm values
```

### Different Environments

**Local Development**:
```yaml
# values-local.yaml
mcp:
  n8nUrl: "http://localhost:5678"
```

**Staging**:
```yaml
# values-staging.yaml
mcp:
  n8nUrl: "http://n8n.staging.svc.cluster.local:5678"
```

**Production**:
```yaml
# values-production.yaml
mcp:
  n8nUrl: "http://n8n.production.svc.cluster.local"
```

### Manual Override

To manually update tools (for testing):

```bash
# Create custom tools.json
cat > /tmp/tools.json <<'EOF'
{
  "tools": [
    {
      "name": "test_tool",
      "webhookPath": "/webhook/tool/test",  # Will use N8N_INTERNAL_URL
      "method": "POST"
    }
  ]
}
EOF

# Copy to MCP server
kubectl cp /tmp/tools.json default/ark-n8n:/tmp/tools/tools.json -c mcp-server

# Restart MCP server to reload
kubectl rollout restart deployment/ark-n8n
```

## Verification

1. Check tools are registered:
   ```bash
   kubectl exec -it deployment/ark-n8n -c mcp-server -- cat /tmp/tools/tools.json
   ```

2. Restart MCP server to load new tools:
   ```bash
   kubectl rollout restart deployment/ark-n8n
   kubectl wait --for=condition=ready pod -l app=ark-n8n --timeout=60s
   ```

3. Verify MCPServer CRD shows correct tool count:
   ```bash
   kubectl get mcpserver n8n-tools -o jsonpath='{.status.toolCount}'
   # Should show: 2
   ```

4. Check MCP server logs:
   ```bash
   kubectl logs -l app=ark-n8n -c mcp-server --tail=20
   # Should show: "✅ Loaded 2 tools from /tmp/tools/tools.json"
   ```

## Adding New Tools

To add a new tool:

1. **Create n8n workflow**:
   - Start with `Webhook` node (path: `/tool/your-tool-name`)
   - Add processing logic
   - End with `Respond to Webhook` node

2. **Export workflow**:
   - Click workflow menu → "Export"
   - Save as `your-tool-name.json`

3. **Add to tool registry**:
   ```json
   {
     "name": "your_tool_name",
     "description": "What your tool does",
     "schema": {
       "type": "object",
       "properties": {
         "param1": {
           "type": "string",
           "description": "Parameter description"
         }
       },
       "required": ["param1"]
     },
     "executionEndpoint": "http://localhost:5678/webhook/tool/your-tool-name",
     "method": "POST"
   }
   ```

4. **Test the tool**:
   ```bash
   curl -X POST http://localhost:5678/webhook/tool/your-tool-name \
     -H "Content-Type: application/json" \
     -d '{"param1": "value"}'
   ```

5. **Update MCP server** (restart to reload tools)

## Troubleshooting

### Webhook Returns 404

**Problem**: `curl` returns 404 Not Found

**Solution**:
1. Check workflow is active: n8n UI → Workflows tab
2. Verify webhook path matches: Should be `/webhook/tool/calculator`
3. Restart n8n if needed: `kubectl rollout restart deployment/ark-n8n`

### Tool Not Showing in MCP

**Problem**: MCPServer shows old tool count

**Solution**:
1. Verify tools.json is updated:
   ```bash
   kubectl exec -it deployment/ark-n8n -c mcp-server -- cat /tmp/tools/tools.json
   ```

2. Restart MCP server:
   ```bash
   kubectl delete pod -l app=ark-n8n
   ```

3. Check MCP logs for errors:
   ```bash
   kubectl logs -l app=ark-n8n -c mcp-server --tail=50
   ```

### Tool Execution Fails

**Problem**: Tool call returns error

**Solution**:
1. Test webhook directly with `curl`
2. Check n8n workflow execution logs
3. Verify request format matches tool schema
4. Check n8n node for error handling

## Next Steps

1. Replace mock weather data with real OpenWeather API
2. Add more tools (web_search, http_request, code_interpreter)
3. Implement automatic tool discovery from n8n workflows
4. Add tool versioning and backwards compatibility

## References

- [n8n Webhook Documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- [MCP Protocol](https://modelcontextprotocol.io)
- [Task #8 Plan](../../TASKS/TASK-8-N8N-TOOL-INTEGRATION.md)
