# n8n API Key Configuration

**Date**: February 10, 2026
**Purpose**: Secure authentication for MCP server → n8n communication

## Overview

The MCP server can authenticate with n8n using API keys for:
1. **Production webhooks** - Secured webhook endpoints
2. **n8n API access** - Workflow management, execution monitoring
3. **Multi-tenant environments** - User-specific authentication

## Architecture

```
┌──────────────────────────────────────────┐
│  Kubernetes Secret                       │
│  n8n-api-key:                           │
│    api-key: "n8n_api_xxx..."           │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│  MCP Server Container                    │
│  env:                                    │
│    N8N_API_KEY: <from secret>          │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│  HTTP Request to n8n                     │
│  headers:                                │
│    X-N8N-API-KEY: ${N8N_API_KEY}        │
└──────────────────────────────────────────┘
```

## Why Kubernetes Secret (Not ConfigMap)?

**ConfigMap**: ❌ For non-sensitive configuration
- Values visible in `kubectl get configmap`
- Stored in plain text
- Not encrypted at rest

**Secret**: ✅ For sensitive data
- Base64 encoded
- Can be encrypted at rest
- RBAC-protected access
- Not visible in plain text

## Implementation

### 1. Create Kubernetes Secret

#### Option A: From Literal Value

```bash
kubectl create secret generic n8n-api-key \
  --from-literal=api-key="n8n_api_1234567890abcdef" \
  --namespace default
```

#### Option B: From File

```bash
# Create file with API key
echo -n "n8n_api_1234567890abcdef" > /tmp/n8n-api-key.txt

# Create secret from file
kubectl create secret generic n8n-api-key \
  --from-file=api-key=/tmp/n8n-api-key.txt \
  --namespace default

# Clean up file
rm /tmp/n8n-api-key.txt
```

#### Option C: From YAML (Not Recommended - Key Visible)

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: n8n-api-key
  namespace: default
type: Opaque
data:
  api-key: bjhuX2FwaV8xMjM0NTY3ODkwYWJjZGVm  # Base64 encoded
```

```bash
# Base64 encode your API key
echo -n "n8n_api_1234567890abcdef" | base64

# Apply secret
kubectl apply -f n8n-api-key-secret.yaml
```

#### Option D: Using Helm (Recommended)

```bash
# Create secret during helm install
helm install ark-n8n ./chart \
  --set n8nApiKey.create=true \
  --set n8nApiKey.value="n8n_api_1234567890abcdef"
```

### 2. Update Helm Chart

**File**: `chart/templates/n8n-api-key-secret.yaml` (NEW)

```yaml
{{- if and .Values.n8nApiKey.create .Values.n8nApiKey.value }}
apiVersion: v1
kind: Secret
metadata:
  name: {{ .Values.n8nApiKey.secretName | default "n8n-api-key" }}
  labels:
    app: {{ .Values.app.name }}
type: Opaque
stringData:
  api-key: {{ .Values.n8nApiKey.value | quote }}
{{- end }}
```

**File**: `chart/values.yaml`

```yaml
# n8n API authentication (optional)
n8nApiKey:
  # Create secret from Helm values (not recommended for production - use external secret)
  create: false
  value: ""  # Set via --set or use existing secret

  # Use existing secret (recommended)
  existingSecret: ""  # Name of existing secret containing 'api-key' key
  secretName: "n8n-api-key"  # Name to use if create=true
```

**File**: `chart/templates/deployment.yaml`

```yaml
# In MCP server container env section:
env:
- name: N8N_INTERNAL_URL
  value: {{ .Values.mcp.n8nUrl | quote }}
{{- if or .Values.n8nApiKey.create .Values.n8nApiKey.existingSecret }}
- name: N8N_API_KEY
  valueFrom:
    secretKeyRef:
      name: {{ .Values.n8nApiKey.existingSecret | default .Values.n8nApiKey.secretName }}
      key: api-key
      optional: true  # Don't fail if secret doesn't exist
{{- end }}
```

### 3. Update MCP Server Code

**File**: `mcp-server/src/main.py`

```python
# Add at top with other config
N8N_API_KEY = os.getenv("N8N_API_KEY", "")  # Optional API key

async def execute_n8n_tool(tool_name: str, tool_config: Dict[str, Any], params: Dict[str, Any]) -> Any:
    """Execute n8n tool via webhook endpoint."""

    # Build endpoint URL
    webhook_path = tool_config.get("webhookPath")
    if webhook_path:
        endpoint = f"{N8N_INTERNAL_URL}{webhook_path}"
    else:
        endpoint = tool_config.get("executionEndpoint")
        if not endpoint:
            endpoint = f"{N8N_INTERNAL_URL}/webhook/tool/{tool_name}"

    print(f"🔧 Executing tool '{tool_name}' via {endpoint}")
    print(f"   Base URL: {N8N_INTERNAL_URL}")
    print(f"   Authentication: {'✅ API Key' if N8N_API_KEY else '🔓 None'}")
    print(f"   Parameters: {params}")

    # Build headers
    headers = {"Content-Type": "application/json"}
    if N8N_API_KEY:
        headers["X-N8N-API-KEY"] = N8N_API_KEY

    try:
        response = await http_client.post(
            endpoint,
            json=params,
            headers=headers  # Include auth header if API key is set
        )
        response.raise_for_status()
        result = response.json()
        print(f"✅ Tool '{tool_name}' executed successfully")

        # Extract result for cleaner output
        if isinstance(result, dict) and "result" in result and "success" in result:
            return str(result["result"]) if result.get("success") else result
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

## Usage Scenarios

### Scenario 1: Local Development (No Auth)

```bash
# No API key needed for local webhooks
helm install ark-n8n ./chart
```

### Scenario 2: Production (With Auth)

```bash
# Step 1: Create secret manually
kubectl create secret generic n8n-api-key \
  --from-literal=api-key="your-production-key"

# Step 2: Install with existing secret
helm install ark-n8n ./chart \
  --set n8nApiKey.existingSecret="n8n-api-key"
```

### Scenario 3: Quick Testing (Create via Helm)

```bash
# WARNING: Not recommended for production (key in values)
helm install ark-n8n ./chart \
  --set n8nApiKey.create=true \
  --set n8nApiKey.value="test-key-123"
```

### Scenario 4: Different Keys per Environment

```bash
# Development
kubectl create secret generic n8n-api-key \
  --from-literal=api-key="dev-key-123" \
  --namespace dev

# Staging
kubectl create secret generic n8n-api-key \
  --from-literal=api-key="staging-key-456" \
  --namespace staging

# Production
kubectl create secret generic n8n-api-key \
  --from-literal=api-key="prod-key-789" \
  --namespace production
```

## Getting n8n API Key

### From n8n UI

1. Go to n8n settings
2. Navigate to: **Settings** → **API** → **API Keys**
3. Click **Create API Key**
4. Copy the generated key (starts with `n8n_api_`)

### From n8n API

```bash
# If you have owner credentials
curl -X POST http://localhost:5678/rest/users/api-key \
  -H "Content-Type: application/json" \
  -d '{"label": "MCP Server Key"}'
```

## Verification

### Check Secret Exists

```bash
kubectl get secret n8n-api-key -n default
# NAME           TYPE     DATA   AGE
# n8n-api-key    Opaque   1      2m
```

### Verify Secret Content (Decode)

```bash
kubectl get secret n8n-api-key -n default -o jsonpath='{.data.api-key}' | base64 -d
# n8n_api_1234567890abcdef
```

### Check Environment Variable in Pod

```bash
kubectl exec -it deployment/ark-n8n -c mcp-server -- env | grep N8N_API_KEY
# N8N_API_KEY=n8n_api_1234567890abcdef
```

### Test MCP Server Logs

```bash
kubectl logs -l app=ark-n8n -c mcp-server --tail=20
# Should show: "Authentication: ✅ API Key"
```

## Security Best Practices

### ✅ DO:
- Use Kubernetes Secrets for API keys
- Enable encryption at rest for secrets
- Use RBAC to restrict secret access
- Rotate API keys regularly
- Use different keys per environment
- Reference existing secrets (don't create from Helm values in production)

### ❌ DON'T:
- Store API keys in ConfigMaps
- Commit secrets to Git
- Use `--set` with actual keys in CI/CD logs
- Share keys between environments
- Log API key values

## Troubleshooting

### Secret Not Found

```bash
# Check secret exists in correct namespace
kubectl get secret n8n-api-key -n default

# If missing, create it
kubectl create secret generic n8n-api-key \
  --from-literal=api-key="your-key"
```

### Authentication Failing

```bash
# Check MCP logs for auth status
kubectl logs -l app=ark-n8n -c mcp-server | grep Authentication

# Test n8n webhook with API key
curl -X POST http://localhost:5678/webhook/tool/calculator \
  -H "Content-Type: application/json" \
  -H "X-N8N-API-KEY: your-key" \
  -d '{"expression": "2 + 2"}'
```

### Wrong Secret Key Name

```bash
# Secret must have key named "api-key"
kubectl get secret n8n-api-key -o yaml

# If wrong key name, recreate secret:
kubectl delete secret n8n-api-key
kubectl create secret generic n8n-api-key \
  --from-literal=api-key="your-key"  # Note: key must be "api-key"
```

## Migration from Old Setup

If you have API key in ConfigMap (insecure):

```bash
# 1. Get value from ConfigMap
API_KEY=$(kubectl get configmap n8n-config -o jsonpath='{.data.api-key}')

# 2. Create Secret
kubectl create secret generic n8n-api-key \
  --from-literal=api-key="$API_KEY"

# 3. Delete ConfigMap
kubectl delete configmap n8n-config

# 4. Update Helm release
helm upgrade ark-n8n ./chart \
  --set n8nApiKey.existingSecret="n8n-api-key"
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
- name: Create n8n API Key Secret
  run: |
    kubectl create secret generic n8n-api-key \
      --from-literal=api-key="${{ secrets.N8N_API_KEY }}" \
      --dry-run=client -o yaml | kubectl apply -f -

- name: Deploy Helm Chart
  run: |
    helm upgrade --install ark-n8n ./chart \
      --set n8nApiKey.existingSecret="n8n-api-key"
```

### GitLab CI

```yaml
# .gitlab-ci.yml
deploy:
  script:
    - echo "$N8N_API_KEY" | kubectl create secret generic n8n-api-key --from-file=api-key=/dev/stdin --dry-run=client -o yaml | kubectl apply -f -
    - helm upgrade --install ark-n8n ./chart --set n8nApiKey.existingSecret="n8n-api-key"
```

## Summary

| Method | Security | Ease | Production? |
|--------|----------|------|-------------|
| Manual `kubectl create secret` | ✅ High | Easy | ✅ Yes |
| Existing secret reference | ✅ High | Easy | ✅ Yes |
| Helm `--set` | ⚠️ Medium | Easy | ⚠️ Only if logs secured |
| Helm values file | ❌ Low | Easy | ❌ No |
| ConfigMap | ❌ Very Low | Easy | ❌ Never |

**Recommended**: Use **existing secret reference** for all environments.

---
**Next Steps**:
1. Create secret in your cluster
2. Update Helm chart templates
3. Update MCP server code
4. Test authentication
5. Document for your team
