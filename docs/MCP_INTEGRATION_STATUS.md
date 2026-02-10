# n8n MCP Server Integration - Status Report

**Date**: February 10, 2026
**Status**: ✅ **Successfully Deployed and Registered**

## Summary

The n8n MCP (Model Context Protocol) server has been successfully integrated into the ARK n8n custom nodes Helm chart as a sidecar container. The MCPServer CRD is registered with ARK and tools are discoverable.

## Deployment Architecture

### Sidecar Pattern
The MCP server runs as a sidecar container alongside n8n in the same pod:

```yaml
Pod: ark-n8n
├── Container: ark-n8n (n8n main application)
│   └── Port: 5678
└── Container: mcp-server (FastMCP server)
    └── Port: 8080 (/mcp endpoint)
```

### Components

1. **MCP Server Container**
   - Image: `ark-n8n-mcp:latest`
   - Port: 8080
   - Endpoint: `/mcp`
   - Health Check: `/health` (returns 200 OK with tool count)
   - Technology: Python 3.12 + FastMCP 2.14.5

2. **Kubernetes Service**
   - Service: `ark-n8n`
   - Ports:
     - `5678/TCP` (n8n UI)
     - `8080/TCP` (MCP endpoint)

3. **MCPServer CRD**
   - Name: `n8n-tools`
   - Namespace: `default`
   - Transport: `http`
   - Address: `http://ark-n8n.default.svc.cluster.local:8080/mcp`
   - Status: **Available: True**
   - Tools Discovered: **2**

## Verification

### Pod Status
```bash
$ kubectl get pods -l app=ark-n8n -n default
NAME                       READY   STATUS    RESTARTS   AGE
ark-n8n-64b9dbb697-5f6x4   2/2     Running   0          10m
```
✅ Both containers (n8n + mcp-server) are running

### MCPServer Registration
```bash
$ kubectl get mcpserver n8n-tools -n default
NAME         TRANSPORT   TOOLS   AVAILABLE   AGE
n8n-tools    http        2       True        5m
```
✅ MCPServer is available and discovered 2 tools

### MCPServer Status
```json
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
✅ Address resolution successful
✅ MCP client creation successful
✅ Tool discovery completed

### Demo Tools Available

1. **calculator**
   - Description: Perform mathematical calculations
   - Input: `expression` (string) - Math expression to evaluate
   - Example: `"25 * 42"` → `"1050"`

2. **word_count**
   - Description: Count words, characters, and unique words in text
   - Input: `text` (string) - Text to analyze
   - Output: `{ "word_count": n, "char_count": n, "unique_words": n }`

## Configuration Files

### Helm Chart Updates

**chart/values.yaml** - Added MCP configuration:
```yaml
mcp:
  enabled: true
  image:
    repository: ark-n8n-mcp
    tag: latest
  port: 8080
  env:
    PORT: "8080"
    TOOLS_SHARED_PATH: /tmp/tools
    N8N_INTERNAL_URL: http://localhost:5678
```

**chart/templates/deployment.yaml** - Added sidecar:
```yaml
- name: mcp-server
  image: {{ .Values.mcp.image.repository }}:{{ .Values.mcp.image.tag }}
  ports:
  - containerPort: {{ .Values.mcp.port }}
  volumeMounts:
  - name: tools-shared
    mountPath: /tmp/tools
```

**chart/templates/service.yaml** - Exposed MCP port:
```yaml
- port: {{ .Values.mcp.port }}
  targetPort: {{ .Values.mcp.port }}
  protocol: TCP
  name: mcp
```

**chart/templates/mcpserver.yaml** - Created MCPServer CRD:
```yaml
apiVersion: ark.mckinsey.com/v1alpha1
kind: MCPServer
metadata:
  name: n8n-tools
spec:
  address:
    valueFrom:
      serviceRef:
        name: {{ .Values.app.name }}
        namespace: {{ .Release.Namespace }}
        port: "mcp"
        path: "/mcp"  # Critical: Path to MCP endpoint
  transport: http
  timeout: 30s
```

## Testing

### Local Testing
```bash
# Port-forward to MCP service
kubectl port-forward svc/ark-n8n 8082:8080 -n default

# Test health endpoint
curl http://localhost:8082/health
# Response: {"status":"healthy","server":"n8n-tools MCP Server","tools_count":2,"mcp_endpoint":"/mcp"}

# Test MCP protocol (requires proper MCP client with session management)
curl -X POST http://localhost:8082/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

### ARK Controller Logs
```bash
kubectl logs -n ark-system ark-controller-c46db845b-vt482 --tail=50 | grep n8n-tools
```

## Troubleshooting History

### Issues Resolved

1. **Port Already in Use** (8000 → 8080)
   - OrbStack was using port 8000
   - Solution: Changed MCP server port to 8080 via `PORT` env var

2. **Health Check 404 Errors**
   - Kubernetes probes checking `/` but MCP listens on `/mcp`
   - Solution: Added health endpoints at `/` and `/health` using FastMCP's `@mcp.custom_route()`

3. **Health Check Function Signature Error**
   - FastMCP route handlers need `request` parameter
   - Solution: Changed `async def health_check():` to `async def health_check(request):`

4. **Dict Not Callable Error**
   - Custom routes need to return Starlette Response objects
   - Solution: Import `JSONResponse` from starlette and return `JSONResponse({...})`

5. **Address Resolution Failed**
   - Controller couldn't find port 8080 in service
   - Solution: Changed MCPServer port from `"8080"` to `"mcp"` (port name)

6. **Client Creation Failed (405 Method Not Allowed)**
   - ARK connecting to `http://ark-n8n:8080` but MCP on `/mcp` path
   - Solution: Added `path: "/mcp"` to MCPServer serviceRef

## Next Steps

1. **Production Tools** (Task #8)
   - Replace demo tools with actual n8n AI tools
   - Implement dynamic tool discovery from n8n
   - Add n8n → MCP tool execution bridge

2. **Agent Configuration**
   - Document how ARK agents can use MCP tools
   - Create example agents with n8n tools
   - Add E2E tests for agent-to-tool workflows

3. **Monitoring**
   - Add metrics for tool invocations
   - Monitor MCP server health and performance
   - Track tool discovery and registration

## References

- **MCP Protocol**: https://modelcontextprotocol.io
- **FastMCP Docs**: https://gofastmcp.com
- **ARK Documentation**: https://github.com/mckinsey/agents-at-scale-ark
- **Project Docs**:
  - [docs/MCP_BRIDGE_ARCHITECTURE.md](MCP_BRIDGE_ARCHITECTURE.md)
  - [TASKS/hybrid-tools/REVISED-MCP-APPROACH.md](../TASKS/hybrid-tools/REVISED-MCP-APPROACH.md)

## Deployment Commands

```bash
# Build MCP server image
cd mcp-server && docker build -t ark-n8n-mcp:latest .

# Deploy to Kubernetes
cd .. && helm upgrade --install ark-n8n ./chart --namespace default

# Verify deployment
kubectl get pods -l app=ark-n8n -n default
kubectl get mcpserver n8n-tools -n default
kubectl logs -l app=ark-n8n -c mcp-server -n default --tail=20

# Check ARK controller logs
kubectl logs -n ark-system -l app.kubernetes.io/name=ark-controller --tail=50
```

## Success Criteria ✅

- [x] MCP server built and containerized
- [x] Sidecar container added to n8n deployment
- [x] Service exposes MCP port (8080)
- [x] MCPServer CRD created and registered
- [x] ARK controller discovers MCP server
- [x] Health checks passing (2/2 containers ready)
- [x] Tools discovered and available (2 tools)
- [x] Address resolution successful
- [x] MCP client creation successful

## Status: Production Ready for Demo Tools ✅

The MCP bridge is fully operational with demo tools. Ready to proceed with integrating actual n8n AI tools.

---
**Last Updated**: February 10, 2026 09:25 UTC
**Deployment**: `ark-n8n` Revision 12
**Pod**: `ark-n8n-64b9dbb697-5f6x4`
