# Architecture Documentation

## Overview

ARK n8n Custom Nodes is a containerized n8n instance with pre-installed custom nodes for interacting with the ARK (Agentic Runtime for Kubernetes) platform. The architecture supports multiple deployment modes: production, demo, and testing.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Client Browser                              │
│                    (http://localhost:8080)                           │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 │ HTTP/WebSocket
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│                    Kubernetes Service Layer                          │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    nginx Reverse Proxy                        │  │
│  │                      (Port 8080)                              │  │
│  │                                                               │  │
│  │  Features:                                                    │  │
│  │  • Auto-login landing page                                   │  │
│  │  • CORS handling (localhost, nip.io)                         │  │
│  │  • WebSocket support with proper header forwarding          │  │
│  │  • Host header preservation ($http_host)                     │  │
│  │  • Session cookie management                                 │  │
│  └──────────────────────┬───────────────────────────────────────┘  │
│                         │                                           │
│                         │ proxy_pass                                │
│                         │                                           │
│  ┌──────────────────────▼───────────────────────────────────────┐  │
│  │                    n8n Application                            │  │
│  │                      (Port 5678)                              │  │
│  │                                                               │  │
│  │  Components:                                                  │  │
│  │  • n8n core workflow engine                                  │  │
│  │  • ARK custom nodes (Agent, Model, Team, Evaluation)         │  │
│  │  • Persistent workflow storage (PVC)                         │  │
│  │  • WebSocket server for real-time updates                    │  │
│  └──────────────────────┬───────────────────────────────────────┘  │
│                         │                                           │
└─────────────────────────┼───────────────────────────────────────────┘
                          │
                          │ HTTP API Calls
                          │
┌─────────────────────────▼───────────────────────────────────────────┐
│                     ARK API Service                                  │
│              (ark-api.ark-system.svc.cluster.local)                  │
│                                                                      │
│  Resources:                                                          │
│  • Agents (CRD)                                                      │
│  • Models (CRD)                                                      │
│  • Teams (CRD)                                                       │
│  • Memory (CRD)                                                      │
│  • Queries (runtime execution)                                       │
└──────────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. nginx Reverse Proxy

**Purpose**: Provides demo mode with auto-login functionality and proper WebSocket/CORS handling for testing.

**Key Responsibilities**:
- Serve auto-login landing page at `/`
- Proxy all other requests to n8n backend
- Handle CORS preflight (OPTIONS) requests
- Forward WebSocket upgrade headers correctly
- Preserve Host header including port for origin validation

**Configuration** (`chart/templates/nginx-proxy.yaml`):
```nginx
# WebSocket support
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;

# Critical: Preserve full Host header including port
proxy_set_header Host $http_host;

# CORS origin mapping
map $http_origin $cors_origin {
  default "";
  "~^http://localhost(:[0-9]+)?$" $http_origin;
  "~^http://127\.0\.0\.1(:[0-9]+)?$" $http_origin;
  "~^http://.*\.127\.0\.0\.1\.nip\.io$" $http_origin;
  "~^http://ark-n8n.*\.nip\.io$" $http_origin;
}
```

**Auto-login Flow**:
```
User visits http://localhost:8080/
  ↓
nginx serves auto-login.html from ConfigMap
  ↓
JavaScript automatically POSTs to /rest/login
  {
    "emailOrLdapLoginId": "admin@example.com",
    "password": "Admin123!@#"
  }
  ↓
n8n authenticates and sets session cookie
  ↓
Browser redirects to /workflows
```

### 2. n8n Application

**Purpose**: Workflow automation platform extended with ARK custom nodes.

**Key Components**:

**n8n Core**:
- Node.js application running on port 5678
- SQLite/PostgreSQL for workflow storage
- WebSocket server for real-time editor updates
- REST API for workflow execution

**ARK Custom Nodes** (installed at `/usr/local/lib/node_modules/n8n-nodes-ark`):
- `ArkAgent`: Simple agent query execution
- `ArkAgentAdvanced`: Agent with memory, session management, and dynamic config
- `ArkModel`: Direct model queries
- `ArkTeam`: Multi-agent team coordination
- `ArkEvaluation`: Quality evaluation

**Environment Configuration** (`chart/values-testing.yaml`):
```yaml
N8N_HOST: localhost:8080              # Must match proxy port for WebSocket
N8N_EDITOR_BASE_URL: http://localhost:8080
WEBHOOK_URL: http://localhost:8080
N8N_PERSONALIZATION_ENABLED: "false"  # Skip onboarding survey
N8N_LOG_LEVEL: debug
```

### 3. ARK API Service

**Purpose**: Backend API managing ARK agents, models, teams, and query execution.

**Endpoints Used by Custom Nodes**:

```
GET    /v1/namespaces/{ns}/agents       # List agents
GET    /v1/namespaces/{ns}/agents/{id}  # Get agent details
PATCH  /v1/namespaces/{ns}/agents/{id}  # Update agent config (dynamic mode)
POST   /v1/namespaces/{ns}/queries      # Execute query

GET    /v1/namespaces/{ns}/models       # List models
GET    /v1/namespaces/{ns}/teams        # List teams
GET    /v1/namespaces/{ns}/memory       # List memory stores
```

**Query Execution Flow**:
```
n8n ARK Node receives user input
  ↓
Node calls POST /v1/namespaces/{ns}/queries
  {
    spec: {
      input: "User question",
      targets: [{ type: "agent", name: "my-agent" }],
      memory: { name: "ark-memory", namespace: "default" },
      sessionId: "user-123-session",
      wait: true,
      timeout: "30s"
    }
  }
  ↓
ARK API creates Query CRD
  ↓
ARK Controller executes agent with configured model/tools
  ↓
Result stored in Query status
  ↓
API returns response to n8n node
  ↓
n8n workflow continues with agent's response
```

## Data Flow

### Workflow Execution with ARK Agent

```
┌────────────────────────────────────────────────────────────────────┐
│ n8n Workflow Editor (Browser)                                       │
│                                                                     │
│  [HTTP Request] → [ARK Agent Node] → [Send Email]                  │
└────────────────────────────────┬───────────────────────────────────┘
                                 │
                                 │ WebSocket (real-time updates)
                                 ↓
┌────────────────────────────────────────────────────────────────────┐
│ n8n Backend                                                         │
│                                                                     │
│  Execution Thread:                                                  │
│    1. Receive HTTP request data                                     │
│    2. Execute ARK Agent node                                        │
│       ↓                                                             │
│       └─→ HTTP POST to ARK API                                      │
│           {                                                         │
│             input: "Summarize this email",                          │
│             targets: [{ type: "agent", name: "summarizer" }]        │
│           }                                                         │
│                                                                     │
└────────────────────────────────┬───────────────────────────────────┘
                                 │
                                 │ HTTP API Call
                                 ↓
┌────────────────────────────────────────────────────────────────────┐
│ ARK API Service                                                     │
│                                                                     │
│  1. Validate query request                                          │
│  2. Create Query CRD in Kubernetes                                  │
│  3. Wait for Query completion (if wait=true)                        │
│  4. Return response:                                                │
│     {                                                               │
│       status: "completed",                                          │
│       response: "Email summary: ...",                               │
│       duration: "2.5s"                                              │
│     }                                                               │
│                                                                     │
└────────────────────────────────┬───────────────────────────────────┘
                                 │
                                 │ Response
                                 ↓
┌────────────────────────────────────────────────────────────────────┐
│ n8n Backend                                                         │
│                                                                     │
│  3. Receive ARK response                                            │
│  4. Pass data to next node (Send Email)                             │
│  5. Complete workflow execution                                     │
│                                                                     │
│     ↓                                                               │
│     WebSocket update to browser                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## WebSocket Connection Flow

Critical for real-time workflow editor updates.

```
Browser establishes WebSocket connection:
  ws://localhost:8080/push
  Origin: http://localhost:8080
    ↓
nginx receives:
  Upgrade: websocket
  Connection: Upgrade
  Host: localhost:8080        ← Browser's host
  Origin: http://localhost:8080
    ↓
nginx forwards to n8n with preserved headers:
  proxy_set_header Host $http_host;           ← Preserves "localhost:8080"
  proxy_set_header Upgrade $http_upgrade;     ← Forwards "websocket"
  proxy_set_header Connection $connection_upgrade;
    ↓
n8n receives:
  Host: localhost:8080        ← Matches origin!
  Origin: http://localhost:8080
    ↓
n8n validates origin matches host
  ✓ localhost:8080 == localhost:8080
    ↓
WebSocket connection established (HTTP 101 Switching Protocols)
    ↓
Real-time updates flow: n8n → WebSocket → Browser
```

**Critical Configuration**:
- nginx: `proxy_set_header Host $http_host;` (NOT `$host` which strips port)
- n8n: `N8N_HOST: localhost:8080` (must match browser's host:port)

## Deployment Modes

### Production Mode

**Configuration**: `chart/values.yaml` (default)

**Characteristics**:
- No nginx proxy (direct n8n access)
- HTTPRoute for ingress via Gateway API
- Authentication required (n8n user management)
- Personalization enabled
- Persistent storage for workflows
- Resource limits: 1 CPU, 2Gi memory

**Use Case**: Production deployments with proper domain and SSL

### Demo Mode

**Configuration**: `chart/values-demo.yaml`

**Characteristics**:
- nginx proxy with auto-login enabled
- Pre-configured credentials (admin@example.com / Admin123!@#)
- CORS enabled for nip.io domains
- Personalization disabled
- Suitable for quick demos and presentations

**Activation**:
```yaml
demo:
  enabled: true
  email: "admin@example.com"
  password: "Admin123!@#"
```

### Testing Mode

**Configuration**: `chart/values-testing.yaml`

**Characteristics**:
- nginx proxy with auto-login enabled
- Authentication disabled (`N8N_USER_MANAGEMENT_DISABLED: "true"`)
- Simpler hostname (localhost:8080)
- Verbose debug logging
- Smaller resource requests (100m CPU, 128Mi memory)
- E2E test optimizations

**Use Case**: Automated E2E testing with Playwright

## Security Considerations

### CORS Configuration

nginx handles CORS for trusted origins:

```nginx
map $http_origin $cors_origin {
  default "";  # Reject unknown origins
  "~^http://localhost(:[0-9]+)?$" $http_origin;
  "~^http://127\.0\.0\.1(:[0-9]+)?$" $http_origin;
  "~^http://.*\.127\.0\.0\.1\.nip\.io$" $http_origin;
  "~^http://ark-n8n.*\.nip\.io$" $http_origin;
}
```

n8n also validates allowed origins:
```yaml
N8N_CORS_ALLOW_ORIGIN: "http://localhost:8080,http://ark-n8n-demo.127.0.0.1.nip.io"
```

### Authentication

**Production Mode**: Full n8n user management with owner account setup

**Demo Mode**: Auto-login with hardcoded credentials (not for production!)

**Testing Mode**: Authentication completely disabled for automated tests

### ARK API Credentials

Stored as Kubernetes Secret, referenced by custom nodes:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: ark-api-credentials
type: Opaque
stringData:
  baseUrl: http://ark-api.ark-system.svc.cluster.local
  namespace: default
  apiKey: pk-ark-xxx:sk-ark-xxx  # Optional
```

## Storage Architecture

### n8n Workflows

**PVC**: `ark-n8n-data` (1Gi)

**Mount Path**: `/home/node/.n8n`

**Contents**:
- SQLite database: `database.sqlite`
- Workflow definitions
- Credential vault
- Execution history
- User preferences

**Persistence**: Data survives pod restarts and upgrades

### nginx Configuration

**ConfigMap**: `ark-n8n-nginx`

**Keys**:
- `nginx.conf`: Main nginx configuration
- `auto-login.html`: Landing page with auto-login script

**Updates**: Requires pod restart to pick up changes

## Troubleshooting Common Issues

### WebSocket "Connection lost" blinking

**Symptom**: Red banner at top of workflow editor saying "Connection lost"

**Cause**: Host header mismatch between browser origin and what n8n receives

**Solution**: Ensure nginx uses `$http_host` instead of `$host`:
```nginx
proxy_set_header Host $http_host;  # Preserves port
```

### Auto-login fails with 401 Unauthorized

**Cause**: Wrong endpoint or field names

**Solution**: Use `/rest/login` endpoint with correct fields:
```javascript
{
  "emailOrLdapLoginId": "admin@example.com",  // NOT "email"
  "password": "Admin123!@#"
}
```

### Custom nodes not appearing

**Cause**: Nodes not installed or N8N_CUSTOM_EXTENSIONS not set

**Solution**: Verify:
```bash
kubectl exec deployment/ark-n8n -- npm list -g n8n-nodes-ark
kubectl exec deployment/ark-n8n -- env | grep N8N_CUSTOM_EXTENSIONS
```

### ARK API connectivity issues

**Cause**: Incorrect service URL or network policy

**Solution**: Test from n8n pod:
```bash
kubectl exec deployment/ark-n8n -- curl http://ark-api.ark-system.svc.cluster.local/v1/agents
```

## Performance Considerations

### Resource Limits

**Production**:
- n8n: 1 CPU, 2Gi memory
- nginx: 100m CPU, 128Mi memory

**Testing**:
- n8n: 200m CPU, 256Mi memory (smaller for faster startup)

### Timeouts

**nginx WebSocket timeouts** (long-running workflows):
```nginx
proxy_connect_timeout 3600s;
proxy_send_timeout 3600s;
proxy_read_timeout 3600s;
```

**ARK Query timeout**:
```yaml
timeout: "30s"  # Configurable per query
```

### Scalability

**Current**: Single replica (stateful due to SQLite)

**For production**: Use PostgreSQL backend for multi-replica deployment:
```yaml
app:
  env:
    DB_TYPE: postgresdb
    DB_POSTGRESDB_HOST: postgres.default.svc.cluster.local
    DB_POSTGRESDB_DATABASE: n8n
```

## Build and Release Process

### Docker Image

**Build Process**:
1. Build custom nodes: `cd nodes && npm run build`
2. Build Docker image:
   ```dockerfile
   FROM docker.n8n.io/n8nio/n8n:latest
   COPY nodes/package.json /tmp/n8n-nodes-ark/
   COPY nodes/dist /tmp/n8n-nodes-ark/dist/
   RUN cd /tmp/n8n-nodes-ark && npm install -g .
   ENV N8N_CUSTOM_EXTENSIONS="/usr/local/lib/node_modules/n8n-nodes-ark"
   ```
3. Push to `ghcr.io/skokaina/ark-n8n:$VERSION`

### Helm Chart

**Package**: `helm package chart/`

**Push**: `oci://ghcr.io/skokaina/charts/ark-n8n`

**Versioning**: SemVer tied to git tags (v0.1.0, v0.2.0, etc.)

## Development Workflow

### Local Development with DevSpace

```bash
devspace dev
```

**Features**:
- Hot-reload: File sync for `nodes/` directory
- Auto-restart on changes
- Port forwarding: localhost:5678 → n8n
- Live logs

### E2E Testing

```bash
make e2e-setup    # Create cluster, install ARK, deploy n8n
make e2e-test     # Run Playwright tests
make e2e-cleanup  # Destroy cluster
```

**Test Flow**:
1. Create k3d cluster with port mappings
2. Install ARK system (API, controllers)
3. Deploy n8n with testing values
4. Setup owner account via Playwright script
5. Run tests: add nodes, configure, execute workflows
6. Capture screenshots/videos on failure
7. Cleanup resources

## Future Enhancements

### Multi-tenancy

Support multiple ARK namespaces per n8n instance with namespace selection in credentials.

### High Availability

- PostgreSQL backend for shared state
- Multiple n8n replicas with session affinity
- Redis for distributed caching

### Observability

- Prometheus metrics export from n8n
- Distributed tracing for ARK API calls
- Grafana dashboards for workflow performance

### Security Hardening

- mTLS between n8n and ARK API
- Kubernetes NetworkPolicies
- Pod Security Standards enforcement
- Secret encryption at rest
