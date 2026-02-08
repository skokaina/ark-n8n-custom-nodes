# ARK Custom Nodes for n8n

Custom n8n nodes for [ARK](https://mckinsey.github.io/agents-at-scale-ark/) (Agentic Runtime for Kubernetes) - compose AI agents, teams, and quality gates in visual workflows.

## What is this?

This package extends n8n with custom nodes that connect to ARK, enabling you to:
- Execute AI agents and multi-agent teams from workflows
- Manage models and evaluate response quality
- Build complex agentic applications with visual programming

## Quick Install

**Prerequisites:** Kubernetes cluster with ARK installed, kubectl, Helm 3.x

### Production Install

```bash
helm install ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n
```

### Demo Install (with default credentials)

```bash
helm install ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  -f https://raw.githubusercontent.com/skokaina/ark-n8n-custom-nodes/main/chart/values-demo.yaml
```

**Demo credentials:** `admin@example.com` / `Admin123!@#`

### Access n8n

```bash
kubectl port-forward svc/ark-n8n 5678:5678
# Open http://localhost:5678
```

**Configure ARK API credentials:**
1. n8n UI → Settings → Credentials → Add Credential → ARK API
2. Enter ARK API URL: `http://ark-api.ark-system.svc.cluster.local`

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
# Install
make quick-install

# Development
make dev

# Testing
make test              # Unit tests
make e2e-setup && make e2e  # E2E tests

# Release
make release-patch     # Bug fixes
make release-minor     # New features
make release-major     # Breaking changes
```

## License

MIT

## Resources

- [ARK Documentation](https://mckinsey.github.io/agents-at-scale-ark/)
- [n8n Documentation](https://docs.n8n.io/)
- [GitHub Repository](https://github.com/skokaina/ark-n8n-custom-nodes)
