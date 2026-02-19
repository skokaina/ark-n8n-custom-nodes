# ARK Custom Nodes for n8n

> Run AI agents on Kubernetes. Orchestrate them visually.

Custom n8n nodes for [ARK](https://mckinsey.github.io/agents-at-scale-ark/) (Agentic Runtime for Kubernetes) — define agents as Kubernetes CRDs, then wire them into visual workflows with memory, multi-agent teams, and quality gates. No Python frameworks required.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/skokaina/ark-n8n-custom-nodes/badge)](https://scorecard.dev/viewer/?uri=github.com/skokaina/ark-n8n-custom-nodes)
[![codecov](https://codecov.io/gh/skokaina/ark-n8n-custom-nodes/branch/main/graph/badge.svg)](https://codecov.io/gh/skokaina/ark-n8n-custom-nodes)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=skokaina_ark-n8n-custom-nodes&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=skokaina_ark-n8n-custom-nodes)

---

## How it works

```mermaid
graph LR
    subgraph "Your Kubernetes Cluster"
        subgraph "ARK Runtime"
            Agent["Agent CRD"]
            Model["Model CRD"]
            Memory["Memory CRD"]
            Team["Team CRD"]
            Eval["Evaluator CRD"]
            Agent --> Model
            Agent --> Memory
            Team --> Agent
            Eval --> Agent
        end
        subgraph "n8n + ARK Nodes"
            WF["n8n Visual Workflow"]
            WF -->|"ARK Agent"| Agent
            WF -->|"ARK Agent Advanced"| Agent
            WF -->|"ARK Team"| Team
            WF -->|"ARK Evaluation"| Eval
        end
    end
    Trigger["Webhook / Schedule / Chat"] --> WF
```

**The idea:** your agents live in Kubernetes as standard CRDs — versioned, scalable, GitOps-friendly. n8n is the visual layer that lets you wire them into real workflows without writing a line of Python.

---


## Quick Install

**Prerequisites:** Kubernetes cluster with [ARK](https://mckinsey.github.io/agents-at-scale-ark/) installed, `kubectl`, Helm 3.x

```bash
# Production
helm install ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n

# Demo (with pre-configured credentials)
helm install ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  -f https://raw.githubusercontent.com/skokaina/ark-n8n-custom-nodes/main/chart/values-demo.yaml
```

**Demo credentials:** `admin@example.com` / `Admin123!@#`

```bash
# Access n8n
kubectl port-forward svc/ark-n8n 5678:5678
# Open http://localhost:5678
```

**Configure credentials:** n8n UI → Settings → Credentials → Add Credential → ARK API → set URL to `http://ark-api.ark-system.svc.cluster.local`

---

## Nodes

### ARK Agent
Execute pre-configured ARK agents with simple queries.

**Use cases:** Basic agent execution, synchronous queries, simple automation

### ARK Agent Advanced
Agent execution with memory, session management, and dynamic configuration.

**Use cases:** Conversational agents, multi-turn dialogues, dynamic model/tool selection at runtime

**Key features:**
- Conversation continuity via session IDs and Memory CRDs
- Static mode (use pre-configured agents) or Dynamic mode (override model/tools from connected nodes)
- ARK-only sub-node connections (Chat Model, Memory, Tools)

### ARK Model
Query AI models directly, bypassing the agent layer.

**Use cases:** Direct model access, model testing, simple completions

### ARK Team
Orchestrate multi-agent teams for collaborative tasks.

**Use cases:** Complex workflows requiring multiple specialized agents, parallel execution strategies

### ARK Evaluation
Score agent responses with configurable quality dimensions.

**Use cases:** Quality assurance, A/B testing, agent performance monitoring

---

## Sample Workflows

Import from [`samples/n8n-workflows/`](./samples/n8n-workflows/):

- [`n8n-workflow.json`](./samples/n8n-workflows/n8n-workflow.json) — Customer support with quality gates
- [`ark-agent-query-basic.json`](./samples/n8n-workflows/ark-agent-query-basic.json) — Basic agent execution
- [`ark-agent-query-with-params.json`](./samples/n8n-workflows/ark-agent-query-with-params.json) — Advanced agent with parameters

n8n UI → Workflows → Import from File → select a file above.

---

## Documentation

| Guide | Description |
|---|---|
| [Walkthrough](./walkthrough.md) | Step-by-step: install, configure, build your first workflow |
| [Configuration](./docs/CONFIGURATION.md) | Helm values, environment variables, custom deployments |
| [Deployment Modes](./docs/DEPLOYMENT_MODES.md) | Production, demo, and testing configurations |
| [Production Guide](./docs/PRODUCTION.md) | Security, monitoring, scaling |
| [Development](./docs/DEVELOPMENT.md) | Local setup, DevSpace, building and testing nodes |
| [Contributing](./docs/CONTRIBUTING.md) | Adding nodes, reporting issues |
| [Troubleshooting](./docs/TROUBLESHOOTING.md) | Common issues and solutions |
| [Release Process](./docs/RELEASE.md) | Versioning, publishing, changelog |

---

## License

MIT — see [LICENSE](LICENSE)

## Resources

- [ARK Documentation](https://mckinsey.github.io/agents-at-scale-ark/)
- [n8n Documentation](https://docs.n8n.io/)

[![Star History Chart](https://api.star-history.com/svg?repos=skokaina/ark-n8n-custom-nodes&type=Date)](https://star-history.com/#skokaina/ark-n8n-custom-nodes&Date)
