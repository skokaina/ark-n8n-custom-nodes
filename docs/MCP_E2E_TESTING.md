# MCP Server E2E Testing Guide

This guide covers how to test the MCP server integration in your E2E environment.

## Quick Start

### Automated Testing

Run the complete MCP integration test:

```bash
make e2e-ark-n8n-mcp
```

This will:
1. Build the MCP Docker image
2. Import it to the k3d cluster
3. Deploy/upgrade ark-n8n with MCP enabled
4. Wait for the pod to be ready (2/2 containers)
5. Verify MCPServer CRD registration
6. Check tool discovery
7. Test the health endpoint
8. Display discovered tools

### Full E2E Test Suite

Run the complete E2E test suite (includes MCP verification):

```bash
make e2e
```

This runs `e2e-ark-n8n-mcp` first, then runs the Playwright E2E tests.

## Manual Testing

### 1. Setup E2E Environment

Create the E2E environment from scratch:

```bash
# First time setup (creates k3d cluster, installs ARK, deploys n8n+MCP)
make e2e-create

# Or if cluster exists, just update the deployment
make e2e-update
```

### 2. Verify MCP Server

Check that MCP is running:

```bash
# Check pod status (should show 2/2 containers)
kubectl get pods -l app=ark-n8n

# Check MCP container logs
kubectl logs -l app=ark-n8n -c mcp-server --tail=20

# Check MCPServer CRD
kubectl get mcpserver n8n-tools -o yaml
```

### 3. Test MCP Health Endpoint

```bash
# Port-forward to MCP service
kubectl port-forward svc/ark-n8n 8082:8080 &

# Test health endpoint
curl http://localhost:8082/health | jq '.'

# Expected response:
# {
#   "status": "healthy",
#   "server": "n8n-tools MCP Server",
#   "tools_count": 2,
#   "mcp_endpoint": "/mcp"
# }

# Stop port-forward
pkill -f "kubectl port-forward svc/ark-n8n"
```

### 4. Run Manual Test Script

```bash
# Comprehensive manual test
./mcp-server/test-mcp-k8s.sh
```

This script performs all verification steps automatically.

## Expected Results

### Pod Status

```bash
$ kubectl get pods -l app=ark-n8n
NAME                       READY   STATUS    RESTARTS   AGE
ark-n8n-64b9dbb697-5f6x4   2/2     Running   0          5m
```

**Key**: `2/2` means both containers are running:
- Container 1: `ark-n8n` (n8n application)
- Container 2: `mcp-server` (MCP sidecar)

### MCPServer CRD

```bash
$ kubectl get mcpserver n8n-tools
NAME         TRANSPORT   TOOLS   AVAILABLE   AGE
n8n-tools    http        2       True        5m
```

**Key**: `AVAILABLE: True` and `TOOLS: 2` confirms:
- ARK controller connected successfully
- Tool discovery completed
- 2 demo tools available (calculator, word_count)

### MCPServer Status

```bash
$ kubectl get mcpserver n8n-tools -o jsonpath='{.status}' | jq '.'
{
  "conditions": [
    {
      "type": "Available",
      "status": "True",
      "reason": "ToolsDiscovered",
      "message": "Successfully discovered 2 tools"
    }
  ],
  "resolvedAddress": "http://ark-n8n.default.svc.cluster.local:8080/mcp",
  "toolCount": 2
}
```

### MCP Server Logs

```bash
$ kubectl logs -l app=ark-n8n -c mcp-server --tail=15
🚀 n8n MCP Server starting with 2 tools:
   - calculator: Perform mathematical calculations
   - word_count: Count words in text

============================================================
🎯 Starting MCP server on http://0.0.0.0:8080/mcp
============================================================

INFO:     192.168.194.1:54888 - "GET /health HTTP/1.1" 200 OK
```

## Troubleshooting

### Pod Not Ready (1/2)

**Symptom**: Pod shows `1/2` ready
```bash
kubectl get pods -l app=ark-n8n
# ark-n8n-xxx   1/2     Running   0          30s
```

**Check MCP logs**:
```bash
kubectl logs -l app=ark-n8n -c mcp-server --tail=50
```

Common issues:
- **Port conflict**: Check if port 8080 is available
- **Image pull error**: Verify `ark-n8n-mcp:test` image exists
- **Health check failing**: Check if `/health` endpoint responds with 200

### MCPServer Not Available

**Symptom**: `kubectl get mcpserver n8n-tools` shows `Available: False`

**Check ARK controller logs**:
```bash
kubectl logs -n ark-system -l app.kubernetes.io/name=ark-controller --tail=50 | grep n8n-tools
```

Common issues:
- **Address resolution failed**: Check service has port 8080 named "mcp"
- **Client creation failed**: Check MCP endpoint path is `/mcp`
- **Connection timeout**: Verify pod and service are healthy

### Health Check Returns 404

**Symptom**: `curl http://localhost:8082/health` returns 404

**Solution**: MCP server might not have health endpoint

**Check**:
```bash
# Verify MCP server is running
kubectl logs -l app=ark-n8n -c mcp-server --tail=20 | grep "Starting MCP server"

# Try the root endpoint
curl http://localhost:8082/
```

### No Tools Discovered

**Symptom**: MCPServer shows `toolCount: 0`

**Check**:
1. MCP server logs for tool loading:
   ```bash
   kubectl logs -l app=ark-n8n -c mcp-server --tail=50 | grep "tools"
   ```

2. Demo tools should be loaded if `/tmp/tools/tools.json` doesn't exist:
   ```
   ⚠️  Tools file not found: /tmp/tools/tools.json
      Using demo tools instead (calculator, word_count)
   ```

## Advanced Testing

### Test with ARK Agent

Create a test agent that uses MCP tools:

```yaml
apiVersion: ark.mckinsey.com/v1alpha1
kind: Agent
metadata:
  name: mcp-test-agent
spec:
  prompt: "You are a helpful assistant with calculator and word count tools."
  modelRef:
    name: default
  tools:
    - name: calculator
      description: "Perform calculations"
      functions:
        - name: calculate
          valueFrom:
            serviceRef:
              name: ark-n8n
              namespace: default
              port: "mcp"
              path: "/mcp"
    - name: word_count
      description: "Count words in text"
      functions:
        - name: count
          valueFrom:
            serviceRef:
              name: ark-n8n
              namespace: default
              port: "mcp"
              path: "/mcp"
```

### Test with ARK Query

```yaml
apiVersion: ark.mckinsey.com/v1alpha1
kind: Query
metadata:
  name: test-calculator
spec:
  input: "What is 25 multiplied by 42?"
  target:
    type: agent
    name: mcp-test-agent
  timeout: 30s
```

Apply and check:
```bash
kubectl apply -f test-agent.yaml
kubectl get query test-calculator -w
kubectl logs -f query/test-calculator
```

## CI/CD Integration

### GitHub Actions

Add to your `.github/workflows/e2e.yml`:

```yaml
- name: Setup E2E Environment
  run: make e2e-create

- name: Verify MCP Integration
  run: make e2e-ark-n8n-mcp

- name: Run E2E Tests
  run: make e2e
```

### Pre-commit Hook

Add to `.git/hooks/pre-push`:

```bash
#!/bin/bash
echo "Running MCP integration tests..."
make e2e-ark-n8n-mcp || exit 1
```

## Performance Benchmarks

Expected timings on a standard developer machine:

| Operation | Time | Notes |
|-----------|------|-------|
| Build MCP image | ~30s | Cached layers speed up subsequent builds |
| Import to k3d | ~5s | Image already built locally |
| Helm upgrade | ~20s | Includes pod restart |
| Pod ready (2/2) | ~10s | Both containers start |
| MCPServer available | ~5s | ARK controller reconciles |
| Health check | ~3s | Port-forward + curl |
| **Total** | **~75s** | Full verification cycle |

## References

- [MCP Integration Status](MCP_INTEGRATION_STATUS.md) - Detailed integration documentation
- [MCP Bridge Architecture](MCP_BRIDGE_ARCHITECTURE.md) - Architecture and design
- [Makefile](../Makefile) - All make targets
- [values-testing.yaml](../chart/values-testing.yaml) - E2E test configuration

## Make Targets Reference

```bash
make e2e-ark-n8n-mcp     # Setup and verify MCP integration (⚡ Fast)
make e2e                 # Run full E2E test suite (includes MCP)
make e2e-create          # Create E2E environment from scratch
make e2e-update          # Update existing E2E environment
make e2e-logs            # View n8n and ARK controller logs
make e2e-status          # Check E2E environment status
make e2e-cleanup         # Delete E2E cluster
```

## Next Steps

Once MCP integration is verified:

1. **Replace demo tools** with actual n8n AI tools
2. **Implement dynamic tool discovery** from n8n
3. **Add E2E tests** for agent-to-tool workflows
4. **Monitor MCP metrics** in production

See [Task #8](../TASKS/hybrid-tools/n8n_ai_tools_integration.md) for details.
