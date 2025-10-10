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
helm install n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  --set ark.apiUrl=http://ark-api.default.svc.cluster.local:8000 \
  --namespace default
```

### Access n8n UI

Port forward to access n8n locally:

```bash
kubectl port-forward svc/ark-n8n 5678:5678 -n default
```

Open in browser: http://localhost:5678

### Configure ARK API Credentials

1. In n8n UI: **Settings** → **Credentials** → **Add Credential** → **ARK API**
2. Enter ARK API URL:
   - In-cluster: `http://ark-api.default.svc.cluster.local:8000`
   - External: `https://your-ark-api.example.com`
3. (Optional) Add authentication if ARK is configured with SSO

## Configuration

### Helm Values

Key configuration options in `chart/values.yaml`:

```yaml
ark:
  apiUrl: http://ark-api.default.svc.cluster.local:8000  # ARK API endpoint

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

Override default values:

```bash
helm install n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  --set ark.apiUrl=https://your-ark-api.example.com \
  --set app.image.tag=v0.0.1 \
  --set storage.size=5Gi \
  --namespace default
```

### Custom Domain Configuration

For production deployments with custom domains:

```bash
helm install n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  --set ark.apiUrl=http://ark-api.default.svc.cluster.local:8000 \
  --set httpRoute.enabled=true \
  --set httpRoute.hostnames[0]=n8n.yourcompany.com \
  --set httpRoute.origin=https://n8n.yourcompany.com \
  --set app.env.N8N_PROTOCOL=https \
  --set app.env.N8N_HOST=n8n.yourcompany.com \
  --namespace default
```

**Note**: The `httpRoute.origin` header is automatically derived from `N8N_PROTOCOL` and the first hostname if not explicitly set.

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

- **ARK Agent Node** - Execute agents with dynamic resource locators
- **ARK Model Node** - Manage AI models from workflow automation
- **ARK Team Node** - Orchestrate multi-agent teams
- **ARK Evaluation Node** - Quality scoring with configurable dimensions
  - Direct evaluation (input/output pairs)
  - Query evaluation (assess historical interactions)
- **Dynamic Resource Discovery** - Agents, models, evaluators populate from ARK API
- **Comprehensive Tests** - 76 tests with >89% coverage

### Coming Soon 🚧

**Additional Nodes**:
- [ ] **ARK Query Node** - List, filter, and replay historical agent executions
- [ ] **ARK API Node** - Generic ARK API calls for advanced workflows
- [ ] **MCP Server Node** - Access Model Context Protocol servers

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

## Architecture

This package provides:

1. **Custom n8n Nodes** (TypeScript)
   - ARK Agent, Model, Team, Evaluation nodes
   - Dynamic resource loading from ARK API
   - Type-safe parameter validation

2. **Dockerfile**
   - Extends official n8n image
   - Pre-installs ARK custom nodes globally
   - Configures N8N_CUSTOM_EXTENSIONS

3. **Helm Chart**
   - Kubernetes deployment for n8n
   - Persistent storage for workflows
   - HTTPRoute for ingress (optional)

4. **DevSpace Configuration**
   - Local development environment
   - File sync for hot-reload
   - Port forwarding and logs

## Development

### Local Development with DevSpace

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

## Troubleshooting

### Nodes not appearing in n8n

1. Check custom nodes are installed:
   ```bash
   kubectl exec -it deployment/ark-n8n -- npm list -g n8n-nodes-ark
   ```

2. Verify environment variable:
   ```bash
   kubectl exec -it deployment/ark-n8n -- env | grep N8N_CUSTOM_EXTENSIONS
   ```

### ARK API connection errors

1. Test connectivity from n8n pod:
   ```bash
   kubectl exec -it deployment/ark-n8n -- curl http://ark-api.default.svc.cluster.local:8000/v1/agents
   ```

2. Verify ARK API is running:
   ```bash
   kubectl get pods -n default | grep ark-api
   ```

3. Check ARK API URL in credentials matches actual endpoint

### Workflows failing to execute

1. Check n8n logs:
   ```bash
   kubectl logs deployment/ark-n8n -f
   ```

2. Verify ARK resources exist (agents, models, evaluators):
   ```bash
   kubectl get agents,models,evaluators
   ```

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
