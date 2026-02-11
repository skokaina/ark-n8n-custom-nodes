# ARK Custom Nodes for n8n

[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/skokaina/ark-n8n-custom-nodes/badge)](https://scorecard.dev/viewer/?uri=github.com/skokaina/ark-n8n-custom-nodes)
[![codecov](https://codecov.io/gh/skokaina/ark-n8n-custom-nodes/branch/main/graph/badge.svg)](https://codecov.io/gh/skokaina/ark-n8n-custom-nodes)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=skokaina_ark-n8n-custom-nodes&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=skokaina_ark-n8n-custom-nodes)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=skokaina_ark-n8n-custom-nodes&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=skokaina_ark-n8n-custom-nodes)

Custom n8n nodes for [ARK](https://mckinsey.github.io/agents-at-scale-ark/) (Agentic Runtime for Kubernetes) - compose AI agents, teams, and quality gates in visual workflows.

## What is this?

This package extends n8n with custom nodes that connect to ARK, enabling you to:
- Execute AI agents and multi-agent teams from workflows
- Manage models and evaluate response quality
- Build complex agentic applications with visual programming

## Features

✨ **One-Line Install** - `curl | bash` and you're done
🔒 **Auto-Login** - Demo mode with default credentials for quick testing
🌐 **Idempotent Nginx Proxy** - Works with any domain without configuration
💾 **Persistent Storage** - 1Gi PVC for workflows and credentials (always enabled)
🔄 **Production Ready** - Disable demo mode for production deployments
📦 **Helm Chart** - Easy upgrades and configuration management

## Quick Install

**Prerequisites:** Kubernetes cluster with [ARK installed](https://mckinsey.github.io/agents-at-scale-ark/), kubectl, Helm 3.x

### One-Line Install

```bash
curl -fsSL https://raw.githubusercontent.com/skokaina/ark-n8n-custom-nodes/main/install.sh | bash
```

**What gets installed:**
- ✅ n8n with ARK custom nodes
- ✅ Auto-login enabled (demo mode)
- ✅ Nginx proxy (works with any domain automatically)
- ✅ 1Gi persistent storage for workflows/credentials

### Manual Install

```bash
# Latest version
helm install ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n

# Specific version
helm install ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n --version 0.1.0
```

### Access n8n

**Local (port-forward):**
```bash
kubectl port-forward svc/ark-n8n-proxy 8080:80
# Open http://localhost:8080
```

**Production (LoadBalancer/Ingress):**
```bash
# Point your LoadBalancer or Ingress to:
#   Service: ark-n8n-proxy
#   Port: 80
# The nginx proxy auto-configures for any domain!
```

**Default credentials (demo mode):**
- Email: `admin@example.com`
- Password: `Admin123!@#`

**Configure ARK API credentials:**
1. n8n UI → Settings → Credentials → Add Credential → ARK API
2. Enter ARK API URL: `http://ark-api.default.svc.cluster.local` (adjust namespace if needed)

---

## Production Deployment

**Disable demo mode for production:**
```bash
helm upgrade ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  --set demo.enabled=false \
  --reuse-values
```

**Configure for your domain:**
```bash
# The nginx proxy auto-configures! Just point your infrastructure:
# 1. Configure LoadBalancer or Ingress to route to:
#    Service: ark-n8n-proxy
#    Port: 80
#
# 2. Set DNS for your domain (e.g., n8n.example.com)
#
# 3. The proxy automatically adapts to the domain!
#    No N8N_HOST configuration needed!
```

**Enable HTTPS (recommended):**
```bash
# Use cert-manager, AWS ACM, or your certificate solution
# The proxy supports HTTPS when configured at the LoadBalancer/Ingress level
```

**Storage management:**
```bash
# Default: 1Gi PVC (always enabled)
# Resize if needed:
kubectl edit pvc ark-n8n-pvc

# Or during install:
helm install ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  --set storage.size=10Gi
```

**Security:**
- Create users via n8n UI after disabling demo mode
- Use strong passwords
- Configure 2FA if available
- Restrict network access via NetworkPolicies

See [Production Guide](./docs/PRODUCTION.md) for detailed security and scaling recommendations.

---

## Custom Nodes

### ARK Agent
Execute pre-configured ARK agents with simple queries.

**Use cases:** Basic agent execution, synchronous queries, simple workflows

**Parameters:**
- Agent name (dropdown populated from ARK)
- Input query
- Wait for completion / async execution

---

### ARK Agent Advanced
Advanced agent execution with memory, session management, and dynamic configuration.

**Use cases:** Conversational agents, multi-turn dialogues, dynamic model/tool selection

**Features:**
- Memory and conversation continuity via session IDs
- Connect n8n AI sub-nodes (Chat Model, Memory, Tools)
- Static mode (use pre-configured agents) or Dynamic mode (update at runtime)

**Parameters:**
- Configuration mode (static/dynamic)
- Agent name
- Memory reference
- Session ID (for conversation history)
- Model and tool overrides

---

### ARK Model
Query and manage AI models directly.

**Use cases:** Direct model access, model testing, simple completions

**Parameters:**
- Model name (dropdown from ARK)
- Input prompt
- Temperature, max tokens, etc.

---

### ARK Team
Orchestrate multi-agent teams for collaborative tasks.

**Use cases:** Complex workflows requiring multiple specialized agents, parallel execution

**Parameters:**
- Team name (dropdown from ARK)
- Input task
- Orchestration strategy

---

### ARK Evaluation
Quality scoring for agent responses with configurable dimensions.

**Use cases:** Quality assurance, A/B testing, agent performance monitoring

**Evaluation types:**
- **Direct**: Evaluate input/output pairs
- **Query**: Assess historical ARK query interactions

**Parameters:**
- Evaluator name (dropdown from ARK)
- Evaluation type
- Input/output or query reference
- Custom dimensions (accuracy, relevance, etc.)

---

## Sample Workflows

Example workflows available in [`samples/n8n-workflows/`](./samples/n8n-workflows/):

- **n8n-workflow.json** - Complete customer support workflow with quality gates
- **ark-agent-query-basic.json** - Basic agent execution
- **ark-agent-query-with-params.json** - Advanced agent with parameters

**Import workflows:**
1. n8n UI → Workflows → Import from File
2. Configure ARK API credentials
3. Execute

## Further Reading

### User Guides
- **[Configuration](./docs/CONFIGURATION.md)** - Helm values, environment variables, custom deployments
- **[Deployment Modes](./docs/DEPLOYMENT_MODES.md)** - Production, demo, and testing configurations
- **[Testing](./docs/TESTING.md)** - E2E tests, unit tests, quality assurance
- **[Production Guide](./docs/PRODUCTION.md)** - Security, monitoring, scaling

### Developer Guides
- **[Development](./docs/DEVELOPMENT.md)** - Local setup, DevSpace, building custom nodes
- **[Contributing](./docs/CONTRIBUTING.md)** - Adding nodes, reporting issues
- **[Release Process](./docs/RELEASE.md)** - Versioning, publishing, changelog

### Reference
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Architecture](./CLAUDE.md)** - Project structure, technical decisions

## Quick Commands

```bash
# Install (one-line)
curl -fsSL https://raw.githubusercontent.com/skokaina/ark-n8n-custom-nodes/main/install.sh | bash

# Or using Makefile
make quick-install

# Access n8n
kubectl port-forward svc/ark-n8n-proxy 8080:80

# Development
make dev

# Testing
make test                    # Unit tests
make e2e-reset && make e2e   # E2E tests

# Upgrade
helm upgrade ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n --reuse-values
```

## License

MIT

## Resources

- [ARK Documentation](https://mckinsey.github.io/agents-at-scale-ark/)
- [n8n Documentation](https://docs.n8n.io/)
- [GitHub Repository](https://github.com/skokaina/ark-n8n-custom-nodes)
