# ARK Custom Nodes for n8n

Custom n8n nodes for ARK (Agentic Runtime for Kubernetes) - compose AI agents, teams, and quality gates in visual workflows.

## Quick Start

### Prerequisites

- Existing ARK cluster with API endpoint accessible
- kubectl configured to access your cluster
- Helm 3.x installed

### Installation

Install n8n with ARK custom nodes using Helm:

```bash
helm install ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n
```

**Note**: The default configuration assumes:
- ARK API is available at `http://ark-api.default.svc.cluster.local:80`
- ARK nginx gateway is deployed in `ark-system` namespace
- If your setup differs, override with `--set ark.apiUrl=<your-ark-api-url>`

### Access n8n UI

**Option 1: Via Gateway (Recommended for ARK clusters)**

Open in browser: http://ark-n8n.default.127.0.0.1.nip.io  


**Option 2: Via Port Forward (Local development)**

```bash
kubectl port-forward svc/ark-n8n 5678:5678 -n default
```

Open in browser: http://localhost:5678

### Configure ARK API Credentials

1. In n8n UI: **Settings** → **Credentials** → **Add Credential** → **ARK API**
2. Enter ARK API URL:
   - In-cluster: `http://ark-api.default.svc.cluster.local:80`
   - External: `https://your-ark-api.example.com`
3. (Optional) Add authentication if ARK is configured with SSO

## Configuration

### Helm Values

Key configuration options in `chart/values.yaml`:

```yaml
ark:
  apiUrl: http://ark-api.default.svc.cluster.local:80  # ARK API endpoint

app:
  image:
    repository: ghcr.io/skokaina/ark-n8n
    tag: latest
  resources:
    limits:
      cpu: 500m
      memory: 512Mi

storage:
  enabled: true
  size: 1Gi
  storageClass: ""  # Use default storage class
```

### Custom Configuration

**Example: Different ARK API URL**

```bash
helm install ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  --set ark.apiUrl=https://your-ark-api.example.com \
  --namespace default
```

**Example: Disable HTTPRoute (for port-forward only access)**

```bash
helm install ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  --set httpRoute.enabled=false \
  --namespace default
```

**Example: Custom domain for production**

```bash
helm install ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  --set httpRoute.hostnames[0]=n8n.yourcompany.com \
  --set httpRoute.origin=n8n.yourcompany.com \
  --set app.env.N8N_PROTOCOL=https \
  --set app.env.N8N_HOST=n8n.yourcompany.com \
  --set app.env.N8N_EDITOR_BASE_URL=https://n8n.yourcompany.com \
  --set app.env.WEBHOOK_URL=https://n8n.yourcompany.com \
  --namespace default
```

### Environment Variables

n8n configuration (set via `app.env` in values.yaml):

- `N8N_HOST` - Hostname for n8n instance
- `N8N_PORT` - Port for n8n server (default: 5678)
- `N8N_PROTOCOL` - http or https
- `GENERIC_TIMEZONE` - Timezone for executions

ARK configuration:

- `ARK_API_URL` - ARK API endpoint (set via `ark.apiUrl`)

## Features

### Implemented ✅

- **ARK Agent Node** - Execute pre-configured agents with simple query interface
- **ARK Agent Advanced Node** - Execute agents with memory, session management, and dynamic configuration
  - Memory and conversation continuity via session IDs
  - Connect Chat Model, Memory, and Tool sub-nodes from n8n
  - Static mode (use pre-configured agents) or Dynamic mode (update at runtime)
- **ARK Model Node** - Manage AI models from workflow automation
- **ARK Team Node** - Orchestrate multi-agent teams
- **ARK Evaluation Node** - Quality scoring with configurable dimensions
  - Direct evaluation (input/output pairs)
  - Query evaluation (assess historical interactions)
- **Dynamic Resource Discovery** - Agents, models, evaluators populate from ARK API
- **Comprehensive Tests** - 76+ tests with >89% coverage

### Coming Soon 🚧

**Additional Nodes**:
- [ ] **ARK API Node** - Generic ARK API calls for advanced workflows

**Node Enhancements**:
- [ ] **Stricter Authentication** - RBAC support, service account credentials
- [ ] **Batch Operations** - Process multiple agents/evaluations in parallel
- [ ] **Workflow Templates** - Pre-built patterns for common use cases

## Sample Workflows

Check the [samples/n8n-workflows](./samples/n8n-workflows/) directory for example workflows:

- **n8n-workflow.json** ⭐ - Complete customer support workflow with quality gates
- **ark-agent-query-basic.json** - Basic agent execution
- **ark-agent-query-with-params.json** - Advanced agent with parameters

Import workflows:
1. n8n UI → **Workflows** → **Import from File**
2. Select workflow JSON file
3. Configure ARK API base URL
4. Save and execute

## Development

### Local Development with DevSpace and ngrok

For local development with external webhooks via ngrok:

**1. Configure environment**

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env`:
```bash
NGROK_DOMAIN=your-subdomain.ngrok-free.app
NGROK_PORT=8080
NGROK_N8N_HOST_HEADER=ark-n8n-devspace.default.127.0.0.1.nip.io
```

**2. Start development environment**

```bash
./devspace-start.sh
```

This script will:
- Check port availability (interactive stop option if port is in use)
- Verify nginx gateway health and fix stale endpoints automatically
- Generate devspace environment overrides from `.env`
- Start kubectl port-forward (8080:80)
- Start ngrok tunnel with your configured domain
- Display local and public URLs

**3. Deploy with devspace**

```bash
devspace dev
```

Your n8n instance will be accessible at:
- Local: http://ark-n8n-devspace.default.127.0.0.1.nip.io:8080
- Public: https://your-subdomain.ngrok-free.app

**4. Stop development environment**

```bash
./devspace-stop.sh
```

This gracefully stops:
- ngrok tunnel
- kubectl port-forward
- Removes temporary config files

**Manual DevSpace (without ngrok)**

Run n8n locally with hot-reload for custom nodes:

```bash
devspace dev
```

Changes to TypeScript files in `nodes/` will trigger automatic rebuild and container restart.

### Run Tests

```bash
cd nodes
npm install
npm test
npm run test:coverage
```

### Build Custom Nodes

```bash
cd nodes
npm run build
```

Compiled JavaScript and type definitions output to `nodes/dist/`.

### Lint Code

```bash
cd nodes
npm run lint
npm run lintfix  # Auto-fix issues
```

## Production Considerations

### Security
1. **Enable Authentication**: Configure n8n user accounts
2. **Use HTTPS**: Set up TLS certificates 
3. **Network Policies**: Restrict cluster access
4. **RBAC**: Implement proper Kubernetes permissions

### Monitoring
1. **Workflow Metrics**: Monitor execution success/failure rates
2. **Resource Usage**: Track CPU/memory consumption  
3. **ARK Integration**: Monitor agent response times and costs
4. **Error Tracking**: Set up alerting for failed workflows

### Scaling
1. **Horizontal Scaling**: Multiple n8n replicas with shared storage
2. **Agent Scaling**: Configure ARK agent auto-scaling
3. **Evaluation Scaling**: Distribute evaluation workloads
4. **Database Scaling**: Use external database for workflows

## Troubleshooting
[Troubleshooting guide](./troubleshooting.md)

## Contributing

### Adding New Nodes

1. Create node file: `nodes/nodes/YourNode/YourNode.node.ts`
2. Implement `INodeType` interface
3. Add tests: `nodes/nodes/YourNode/__tests__/YourNode.node.test.ts`
4. Export in `nodes/package.json` under `n8n.nodes`
5. Build and test locally

### Reporting Issues

Open issues at: https://github.com/skokaina/ark-n8n-custom-nodes/issues

Include:
- n8n version
- ARK version
- Node version (TypeScript/JavaScript)
- Error messages and logs
- Steps to reproduce

## License

MIT

## Resources

- [ARK Documentation](https://mckinsey.github.io/agents-at-scale-ark/)
- [n8n Documentation](https://docs.n8n.io/)
- [Creating n8n Nodes](https://docs.n8n.io/integrations/creating-nodes/)

