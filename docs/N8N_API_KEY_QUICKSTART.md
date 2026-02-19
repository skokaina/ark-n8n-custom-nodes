# n8n API Key - Quick Start Guide

**5-Minute Setup** for securing MCP ↔ n8n communication

## Prerequisites

- Kubernetes cluster running
- kubectl configured
- n8n API key (get from n8n UI: Settings → API → Create API Key)

## Setup Options

### Option 1: Production (Recommended) ✅

**Step 1**: Create secret manually
```bash
kubectl create secret generic n8n-api-key \
  --from-literal=api-key="n8n_api_your_actual_key_here" \
  --namespace default
```

**Step 2**: Deploy with existing secret
```bash
helm upgrade --install ark-n8n ./chart \
  --set n8nApiKey.existingSecret="n8n-api-key"
```

**Step 3**: Verify
```bash
# Check secret exists
kubectl get secret n8n-api-key

# Check MCP logs show authentication enabled
kubectl logs -l app=ark-n8n -c mcp-server | grep "Authentication"
# Should show: "Authentication: ✅ API Key"
```

### Option 2: Quick Testing ⚡

For local development/testing only:

```bash
helm upgrade --install ark-n8n ./chart \
  --set n8nApiKey.create=true \
  --set n8nApiKey.value="n8n_api_test_key_123"
```

⚠️ **Warning**: Don't use this in production (key visible in Helm values)

### Option 3: No Authentication ⚠️

For local testing/development only (tool calls to n8n will fail if n8n requires auth):

```bash
helm upgrade --install ark-n8n ./chart
```

Server will start with warning:
```
============================================================
⚠️  WARNING: N8N_API_KEY not configured!
   n8n tool calls will fail with 401 Unauthorized
============================================================
```

**Note**: This is useful for:
- Testing MCP server startup
- Local development without n8n authentication
- Troubleshooting connection issues

For production or actual tool execution, use Option 1 or Option 2.

## Getting Your n8n API Key

### From n8n UI:
1. Open n8n → **Settings** (gear icon)
2. Go to **API** tab
3. Click **Create API Key**
4. Label it: "MCP Server"
5. Copy the key (starts with `n8n_api_`)

### From n8n Docker/K8s:
```bash
# Get API key from n8n environment if already set
kubectl exec -it deployment/ark-n8n -- env | grep N8N_API_KEY
```

## Verification Steps

### 1. Check Secret Exists
```bash
kubectl get secret n8n-api-key -n default
```

### 2. Verify Secret Value (Decode)
```bash
kubectl get secret n8n-api-key -o jsonpath='{.data.api-key}' | base64 -d
# Should output your API key
```

### 3. Check Environment Variable in Pod
```bash
kubectl exec -it deployment/ark-n8n -c mcp-server -- env | grep N8N_API_KEY
# Should show: N8N_API_KEY=n8n_api_...
```

### 4. Check MCP Logs
```bash
kubectl logs -l app=ark-n8n -c mcp-server --tail=30 | grep Authentication
# Should show: "Authentication: ✅ API Key" when calling tools
```

### 5. Test Tool Execution
```bash
# Port-forward to MCP server
kubectl port-forward svc/ark-n8n 8082:8080 &

# Test health (doesn't require auth)
curl http://localhost:8082/health

# Test actual tool call (will use API key)
# This will appear in MCP logs with authentication status
```

## Troubleshooting

### Secret Not Found
```bash
# List all secrets
kubectl get secrets -n default

# If missing, create it:
kubectl create secret generic n8n-api-key \
  --from-literal=api-key="your-key"
```

### Wrong Secret Key Name
```bash
# Secret MUST have key named "api-key" (not "apiKey" or "API_KEY")
kubectl get secret n8n-api-key -o yaml

# Look for:
# data:
#   api-key: <base64-value>  ✅ Correct

# If wrong, recreate:
kubectl delete secret n8n-api-key
kubectl create secret generic n8n-api-key \
  --from-literal=api-key="your-key"  # Must be "api-key"
```

### Authentication Still Showing "None"
```bash
# Check if secret reference is configured in Helm values
helm get values ark-n8n

# Should show:
# n8nApiKey:
#   existingSecret: "n8n-api-key"

# If not, upgrade with correct setting:
helm upgrade ark-n8n ./chart \
  --reuse-values \
  --set n8nApiKey.existingSecret="n8n-api-key"
```

### n8n Webhook Returns 401 Unauthorized
```bash
# Verify API key is correct in n8n
# Test with curl:
curl -X POST http://localhost:5678/webhook/tool/calculator \
  -H "Content-Type: application/json" \
  -H "X-N8N-API-KEY: your-key" \
  -d '{"expression": "2+2"}'

# If 401, key is wrong or expired - create new one in n8n
```

## Environment-Specific Keys

### Development
```bash
kubectl create secret generic n8n-api-key \
  --from-literal=api-key="dev_key_123" \
  --namespace dev
```

### Staging
```bash
kubectl create secret generic n8n-api-key \
  --from-literal=api-key="staging_key_456" \
  --namespace staging
```

### Production
```bash
# Use production API key from secrets manager
kubectl create secret generic n8n-api-key \
  --from-literal=api-key="${PROD_N8N_API_KEY}" \
  --namespace production
```

## CI/CD Integration

### GitHub Actions
```yaml
- name: Create n8n API Secret
  run: |
    kubectl create secret generic n8n-api-key \
      --from-literal=api-key="${{ secrets.N8N_API_KEY }}" \
      --dry-run=client -o yaml | kubectl apply -f -
```

### GitLab CI
```yaml
deploy:
  script:
    - echo "$N8N_API_KEY" | kubectl create secret generic n8n-api-key --from-file=api-key=/dev/stdin --dry-run=client -o yaml | kubectl apply -f -
```

## Summary

| What | Command |
|------|---------|
| **Create Secret** | `kubectl create secret generic n8n-api-key --from-literal=api-key="your-key"` |
| **Deploy with Secret** | `helm upgrade ark-n8n ./chart --set n8nApiKey.existingSecret="n8n-api-key"` |
| **Check Secret** | `kubectl get secret n8n-api-key` |
| **Verify in Pod** | `kubectl exec deployment/ark-n8n -c mcp-server -- env \| grep N8N_API_KEY` |
| **Check Logs** | `kubectl logs -l app=ark-n8n -c mcp-server \| grep Authentication` |

---
**Time to Complete**: ~5 minutes
**Security**: ✅ Secret stored in Kubernetes, not ConfigMap or plain text
**Required**: ⚠️  Optional but recommended for production
**Production Ready**: ✅ Yes, when using existing secret
