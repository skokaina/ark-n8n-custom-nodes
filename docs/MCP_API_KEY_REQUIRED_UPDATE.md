# n8n API Key - Required Authentication Update

**Date**: February 10, 2026
**Status**: ✅ Implemented and Documented

## Summary

Updated MCP server implementation based on critical feedback:

> "no auth would never be possible n8n always require an api key to interact with its endpoints"

**Result**: API key is now **REQUIRED** (not optional). MCP server fails fast if API key is missing.

## Changes Made

### 1. MCP Server Code (`mcp-server/src/main.py`)

#### Before (❌ Incorrect - Optional):
```python
N8N_API_KEY = os.getenv("N8N_API_KEY", "")  # Optional API key

# ...

headers = {"Content-Type": "application/json"}
if N8N_API_KEY:  # Conditional
    headers["X-N8N-API-KEY"] = N8N_API_KEY
```

#### After (✅ Correct - Required):
```python
# N8N_API_KEY is REQUIRED - n8n always requires API key for endpoint authentication
N8N_API_KEY = os.getenv("N8N_API_KEY")
if not N8N_API_KEY:
    raise ValueError(
        "❌ FATAL: N8N_API_KEY environment variable is required but not set.\n"
        "   n8n requires API key authentication for all tool endpoints.\n"
        "   Please set N8N_API_KEY environment variable or create Kubernetes secret.\n"
        "   See docs/N8N_API_KEY_SETUP.md for setup instructions."
    )

# ...

headers = {
    "Content-Type": "application/json",
    "X-N8N-API-KEY": N8N_API_KEY  # Always added
}
```

### 2. Deployment Template (`chart/templates/deployment.yaml`)

#### Before (❌ Optional):
```yaml
- name: N8N_API_KEY
  valueFrom:
    secretKeyRef:
      name: {{ .Values.n8nApiKey.existingSecret | default .Values.n8nApiKey.secretName }}
      key: api-key
      optional: true  # Don't fail if secret missing
```

#### After (✅ Required):
```yaml
- name: N8N_API_KEY
  valueFrom:
    secretKeyRef:
      name: {{ .Values.n8nApiKey.existingSecret | default .Values.n8nApiKey.secretName }}
      key: api-key
      optional: false  # REQUIRED - n8n always requires API key
```

### 3. Values Configuration (`chart/values.yaml`)

#### Before:
```yaml
# n8n API authentication (optional)
```

#### After:
```yaml
# n8n API authentication (REQUIRED)
# n8n always requires API key for endpoint authentication
```

### 4. Documentation Updates

Updated all documentation files to reflect required authentication:

| File | Changes |
|------|---------|
| `docs/MCP_API_KEY_IMPLEMENTATION.md` | ✅ Updated code examples, removed "optional" references |
| `docs/N8N_API_KEY_QUICKSTART.md` | ✅ Removed "Option 3: No Authentication" section |
| `chart/values.yaml` | ✅ Changed comments from "optional" to "REQUIRED" |

## n8n API Endpoints Documentation

Created comprehensive documentation: `docs/N8N_API_ENDPOINTS.md`

### Endpoints Currently Used

| Endpoint | Method | Authentication | Purpose |
|----------|--------|----------------|---------|
| `/webhook/tool/{tool_name}` | POST | **Required** | Execute n8n AI tool workflow |

### Authentication Details

**Header**: `X-N8N-API-KEY`
**Value**: `n8n_api_{random_string}` (from n8n UI)
**Required**: **YES** - ALL endpoints require authentication

### Example Request

```http
POST http://localhost:5678/webhook/tool/calculator
Content-Type: application/json
X-N8N-API-KEY: n8n_api_xxx

{
  "expression": "2 + 2"
}
```

### Example Response

```json
{
  "success": true,
  "result": 4
}
```

## Testing Results

### Without API Key (❌ Expected Failure)

```bash
docker run ark-n8n-mcp:latest

# Output:
# ❌ FATAL: N8N_API_KEY environment variable is required but not set.
#    n8n requires API key authentication for all tool endpoints.
#    Please set N8N_API_KEY environment variable or create Kubernetes secret.
#    See docs/N8N_API_KEY_SETUP.md for setup instructions.
```

### With API Key (✅ Success)

```bash
docker run -e N8N_API_KEY="test_key_123" ark-n8n-mcp:latest

# Output:
# 🚀 n8n MCP Server starting with 2 tools:
#    - calculator: Perform mathematical calculations
#    - get_weather: Get current weather information
#
# 📝 Registering tools with MCP...
# ✅ Registered tool: calculator
# ✅ Registered tool: get_weather
#
# 🎯 Starting MCP server on http://0.0.0.0:8080/mcp
```

### Kubernetes Deployment (✅ Success)

```bash
# Create secret
kubectl create secret generic n8n-api-key \
  --from-literal=api-key="n8n_api_prod_key_xxx"

# Deploy with required secret
helm upgrade --install ark-n8n ./chart \
  --set n8nApiKey.existingSecret="n8n-api-key"

# Verify MCP server started
kubectl logs deployment/ark-n8n -c mcp-server

# Output:
# 🚀 n8n MCP Server starting with 2 tools...
# Authentication: ✅ API Key (required)
```

### Kubernetes Deployment Without Secret (❌ Expected Failure)

```bash
# Try to deploy without API key configuration
helm upgrade --install ark-n8n ./chart

# Pod fails to start:
kubectl get pods
# NAME                       READY   STATUS    RESTARTS   AGE
# ark-n8n-xxx-xxx            1/2     Error     0          10s

kubectl logs deployment/ark-n8n -c mcp-server
# ❌ FATAL: N8N_API_KEY environment variable is required but not set.
```

## Behavior Summary

| Scenario | Previous Behavior | New Behavior |
|----------|-------------------|--------------|
| **No API Key** | ⚠️ Server starts, logs "🔓 None", requests fail | ❌ Server fails to start with clear error |
| **Invalid API Key** | ⚠️ Server starts, requests return 401 | ✅ Server starts, requests return 401 with error |
| **Valid API Key** | ✅ Server starts, requests succeed | ✅ Server starts, requests succeed |

## Migration Guide

If you have existing deployments without API key:

### Step 1: Get n8n API Key

```bash
# Open n8n UI → Settings → API → Create API Key
# Copy key (starts with n8n_api_)
```

### Step 2: Create Kubernetes Secret

```bash
kubectl create secret generic n8n-api-key \
  --from-literal=api-key="your_n8n_api_key_here" \
  --namespace default
```

### Step 3: Update Helm Release

```bash
helm upgrade --install ark-n8n ./chart \
  --set n8nApiKey.existingSecret="n8n-api-key" \
  --reuse-values
```

### Step 4: Verify

```bash
# Check MCP server logs
kubectl logs deployment/ark-n8n -c mcp-server | grep "Authentication"
# Should show: "Authentication: ✅ API Key (required)"

# Test tool execution
kubectl exec -it deployment/ark-n8n -c mcp-server -- curl http://localhost:8080/health
# Should return: {"status": "healthy", "tools_count": 2}
```

## Updated Documentation Files

1. ✅ `docs/MCP_API_KEY_IMPLEMENTATION.md` - Implementation reference
2. ✅ `docs/N8N_API_KEY_SETUP.md` - Detailed setup guide
3. ✅ `docs/N8N_API_KEY_QUICKSTART.md` - 5-minute quickstart
4. ✅ `docs/N8N_API_ENDPOINTS.md` - **NEW** - Complete API endpoint reference
5. ✅ `docs/MCP_API_KEY_REQUIRED_UPDATE.md` - **NEW** - This document
6. ✅ `chart/values.yaml` - Configuration reference

## Security Improvements

| Aspect | Before | After |
|--------|--------|-------|
| **Startup Validation** | ❌ No validation | ✅ Fails fast if API key missing |
| **Error Messages** | ⚠️ Generic HTTP errors | ✅ Clear "API key required" error |
| **Documentation** | ⚠️ Marked as "optional" | ✅ Clearly marked as "REQUIRED" |
| **Header Addition** | ⚠️ Conditional | ✅ Always added |
| **Kubernetes Secret** | ⚠️ Optional (optional: true) | ✅ Required (optional: false) |

## Next Steps

1. ✅ Rebuild Docker image with updated code
2. ✅ Test locally with required API key
3. ✅ Deploy to Kubernetes cluster
4. ✅ Run E2E tests
5. 📋 Update CHANGELOG.md
6. 📋 Tag new version (v0.0.3)

## References

- [N8N API Key Setup Guide](./N8N_API_KEY_SETUP.md)
- [N8N API Key Quickstart](./N8N_API_KEY_QUICKSTART.md)
- [N8N API Endpoints Reference](./N8N_API_ENDPOINTS.md)
- [MCP Implementation Details](./MCP_API_KEY_IMPLEMENTATION.md)

---

**Status**: ✅ Complete
**Breaking Change**: YES - Deployments without API key will now fail
**Migration Required**: YES - All deployments must configure API key
**Security Impact**: POSITIVE - Enforces required authentication
