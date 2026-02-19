# MCP Server - Environment Variable Configuration

**Date**: February 10, 2026
**Change**: Removed hardcoded URLs, made n8n endpoint configurable

## Problem

Previously, n8n webhook URLs were hardcoded in the ConfigMap:
```json
{
  "executionEndpoint": "http://localhost:5678/webhook/tool/calculator"  ❌
}
```

**Issues**:
- Not configurable per environment (dev/staging/prod)
- Hardcoded localhost assumption
- Requires ConfigMap updates to change URL

## Solution

Split configuration into two parts:

### 1. Base URL (Environment Variable)

**Configured in Helm values**:
```yaml
mcp:
  n8nUrl: "http://localhost:5678"  # ✅ Configurable per environment
```

**Injected as environment variable**:
```yaml
env:
  - name: N8N_INTERNAL_URL
    value: {{ .Values.mcp.n8nUrl }}
```

### 2. Webhook Path (ConfigMap)

**Stored as relative path**:
```json
{
  "name": "calculator",
  "webhookPath": "/webhook/tool/calculator",  # ✅ Relative path
  "method": "POST"
}
```

### 3. URL Construction (Runtime)

**MCP server combines them**:
```python
endpoint = f"{N8N_INTERNAL_URL}{webhook_path}"
# Result: "http://localhost:5678/webhook/tool/calculator"
```

## Changes Made

### 1. MCP Server Code (`mcp-server/src/main.py`)

```python
# Before
endpoint = tool_config.get("executionEndpoint")  # Hardcoded in JSON

# After
webhook_path = tool_config.get("webhookPath")
if webhook_path:
    endpoint = f"{N8N_INTERNAL_URL}{webhook_path}"  # From env var
else:
    # Backwards compatible with executionEndpoint
    endpoint = tool_config.get("executionEndpoint")
```

### 2. ConfigMap (`chart/templates/mcp-tools-configmap.yaml`)

```json
// Before
{
  "executionEndpoint": "http://localhost:5678/webhook/tool/calculator"
}

// After
{
  "webhookPath": "/webhook/tool/calculator"  // Just the path
}
```

### 3. Helm Values (`chart/values.yaml`)

```yaml
# NEW: Configurable n8n URL
mcp:
  n8nUrl: "http://localhost:5678"  # Default for local dev

  env:
    PORT: "8080"
    TOOLS_SHARED_PATH: /tmp/tools
    # N8N_INTERNAL_URL is set from mcp.n8nUrl in deployment
```

### 4. Deployment (`chart/templates/deployment.yaml`)

```yaml
# NEW: Inject N8N_INTERNAL_URL from values
env:
- name: N8N_INTERNAL_URL
  value: {{ .Values.mcp.n8nUrl | quote }}
```

## Environment-Specific Configuration

### Local Development

```yaml
# values-local.yaml
mcp:
  n8nUrl: "http://localhost:5678"
```

### Kubernetes (Same Namespace)

```yaml
# values-k8s.yaml
mcp:
  n8nUrl: "http://localhost:5678"  # Sidecar pattern
```

### Kubernetes (Different Namespace)

```yaml
# values-k8s-external.yaml
mcp:
  n8nUrl: "http://n8n.n8n-namespace.svc.cluster.local:5678"
```

### Production

```yaml
# values-production.yaml
mcp:
  n8nUrl: "http://n8n.production.svc.cluster.local"
```

## Backwards Compatibility

**Legacy format still supported**:
```json
{
  "name": "external_tool",
  "executionEndpoint": "https://api.example.com/tool",  // ✅ Full URL
  "method": "POST"
}
```

**Use cases**:
- External APIs outside n8n
- Custom webhook endpoints
- Migration from old format

## Testing

### Local Test

```bash
# Build with new code
cd mcp-server
docker build -t ark-n8n-mcp:latest .

# Test with environment variable
docker run --rm -p 8082:8080 \
  -e N8N_INTERNAL_URL=http://test-n8n:9999 \
  -v $(pwd)/test-tools.json:/tmp/tools/tools.json \
  ark-n8n-mcp:latest

# Check logs - should show:
# "🔧 Executing tool 'calculator' via http://test-n8n:9999/webhook/tool/calculator"
# "   Base URL: http://test-n8n:9999"
```

### Kubernetes Test

```bash
# Deploy with custom URL
helm upgrade ark-n8n ./chart \
  --set mcp.n8nUrl="http://custom-n8n:5678"

# Verify environment variable
kubectl exec -it deployment/ark-n8n -c mcp-server -- env | grep N8N_INTERNAL_URL
# Should show: N8N_INTERNAL_URL=http://custom-n8n:5678

# Check MCP logs
kubectl logs -l app=ark-n8n -c mcp-server --tail=20
# Should show: "Base URL: http://custom-n8n:5678"
```

## Migration Guide

If you have existing custom tools.json files:

### Option 1: Update to New Format (Recommended)

```bash
# Convert executionEndpoint to webhookPath
sed 's/"executionEndpoint": "http:\/\/localhost:5678/"webhookPath": "/' tools.json
```

### Option 2: Keep Legacy Format

No changes needed - old format still works:
```json
{
  "executionEndpoint": "http://localhost:5678/webhook/tool/calculator"
}
```

### Option 3: Mix Both Formats

```json
{
  "tools": [
    {
      "name": "internal_tool",
      "webhookPath": "/webhook/tool/internal"  // ✅ Uses N8N_INTERNAL_URL
    },
    {
      "name": "external_tool",
      "executionEndpoint": "https://api.external.com/webhook"  // ✅ Full URL
    }
  ]
}
```

## Benefits

✅ **Environment Flexibility**: Different URLs per environment
✅ **Security**: No hardcoded credentials or endpoints
✅ **Maintainability**: Change URL once in values.yaml
✅ **Backwards Compatible**: Old format still works
✅ **Visibility**: Logs show both base URL and full endpoint

## Files Changed

- ✅ `mcp-server/src/main.py` - URL construction logic
- ✅ `chart/values.yaml` - Added mcp.n8nUrl
- ✅ `chart/values-testing.yaml` - Added n8nUrl for tests
- ✅ `chart/templates/deployment.yaml` - Inject N8N_INTERNAL_URL env var
- ✅ `chart/templates/mcp-tools-configmap.yaml` - Use webhookPath instead of executionEndpoint
- ✅ `samples/mcp-tools/README.md` - Updated documentation
- ✅ `samples/mcp-tools/tools.json.example` - New format example

## Next Steps

1. Rebuild MCP Docker image
2. Deploy to Kubernetes
3. Verify environment variable is set correctly
4. Test tool execution with new URL construction

---
**Last Updated**: February 10, 2026
**Status**: ✅ Complete
**Breaking Changes**: None (backwards compatible)
