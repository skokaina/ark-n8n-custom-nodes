# ARK Custom Nodes for n8n - Development Guide

## Overview

This repository contains custom n8n nodes for ARK (Agentic Runtime for Kubernetes) packaged as a standalone, deployable service.

## Project Structure

```
ark-n8n-custom-nodes/
├── .github/workflows/  - CI/CD pipelines (lint, test, build, helm)
├── nodes/              - Custom n8n nodes (TypeScript)
│   ├── credentials/    - ARK API credential definition
│   ├── nodes/          - Node implementations (Agent, Model, Team, Evaluation)
│   ├── test-helpers/   - Test utilities and fixtures
│   └── __tests__/      - Comprehensive test suites
├── chart/              - Helm chart for Kubernetes deployment
│   ├── templates/      - K8s resource templates
│   ├── Chart.yaml      - Chart metadata
│   └── values.yaml     - Default configuration
├── samples/            - Example n8n workflows
├── Dockerfile          - Custom n8n image with ARK nodes pre-installed
└── devspace.yaml       - Local development configuration
```

## Development Workflow

### Custom Nodes Development

**Location**: `nodes/`

All custom nodes follow the n8n `INodeType` interface pattern:

```typescript
export class ArkAgent implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'ARK Agent',
    name: 'arkAgent',
    // ... properties, credentials, methods
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    // Node execution logic
  }
}
```

**Key files**:
- `nodes/nodes/ArkAgent/ArkAgent.node.ts` - Simple agent execution node
- `nodes/nodes/ArkAgentAdvanced/ArkAgentAdvanced.node.ts` - Advanced agent with memory, session management, and dynamic configuration
- `nodes/nodes/ArkModel/ArkModel.node.ts` - Model query node
- `nodes/nodes/ArkTeam/ArkTeam.node.ts` - Multi-agent team coordination
- `nodes/nodes/ArkEvaluation/ArkEvaluation.node.ts` - Quality evaluation node
- `nodes/credentials/ArkApi.credentials.ts` - ARK API authentication
- `nodes/utils/arkHelpers.ts` - Shared utility functions for ARK API interactions

### Building Nodes

```bash
cd nodes
npm install
npm run build  # Compiles TypeScript to dist/
```

Output: `nodes/dist/` contains compiled JavaScript and type definitions.

### Running Tests

```bash
cd nodes
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Generate coverage report (target: >80%)
```

Tests use Jest with mocked n8n workflow functions. See `nodes/test-helpers/mocks.ts` for helper utilities.

### Linting

```bash
cd nodes
npm run lint        # Check for issues
npm run lintfix     # Auto-fix issues
```

Uses ESLint + Prettier with TypeScript support.

## Local Development with DevSpace

DevSpace enables local development with hot-reload:

```bash
devspace dev
```

**What happens**:
1. Builds custom nodes (`npm run build` in nodes/)
2. Builds Docker image with ARK nodes
3. Deploys to local Kubernetes cluster
4. Sets up file sync: `nodes/` → container `/tmp/n8n-nodes-ark`
5. Restarts container on file changes
6. Port forwards 5678:5678 for n8n UI access

**Access n8n**: http://localhost:5678

## Dockerfile Architecture

The Dockerfile extends the official n8n image:

```dockerfile
ARG N8N_VERSION=latest
FROM docker.n8n.io/n8nio/n8n:${N8N_VERSION}

# Copy pre-built nodes
COPY nodes/package.json /tmp/n8n-nodes-ark/
COPY nodes/dist /tmp/n8n-nodes-ark/dist/

# Install globally so n8n discovers nodes
RUN npm install -g .

# Configure n8n to load custom nodes
ENV N8N_CUSTOM_EXTENSIONS="/usr/local/lib/node_modules/n8n-nodes-ark"
```

**Key points**:
- Nodes must be built BEFORE docker build
- Global npm install allows n8n to discover nodes
- `N8N_CUSTOM_EXTENSIONS` env var tells n8n where to find them

## Helm Chart Configuration

### Values Structure

```yaml
ark:
  apiUrl: http://ark-api.default.svc.cluster.local:8000  # ARK API endpoint

app:
  image:
    repository: ghcr.io/skokaina/ark-n8n
    tag: latest
  env:
    N8N_HOST: ark-n8n.default.127.0.0.1.nip.io
    N8N_PORT: "5678"
    # ... other n8n config

storage:
  enabled: true
  size: 1Gi
```

### Templates

- `chart/templates/deployment.yaml` - Main n8n deployment
- `chart/templates/service.yaml` - ClusterIP service
- `chart/templates/pvc.yaml` - Persistent storage for workflows
- `chart/templates/httproute.yaml` - Gateway API routing (optional)

## CI/CD Workflows

### lint.yml

**Triggers**: Push to main, PRs
**Steps**: npm install → ESLint → TypeScript compilation check

### test.yml

**Triggers**: Push to main, PRs
**Steps**: npm install → jest with coverage → fail if <80%

### build.yml

**Triggers**: Tags (v*), manual dispatch
**Steps**:
1. Build custom nodes (`npm run build`)
2. Docker buildx for multi-arch (amd64, arm64)
3. Push to `ghcr.io/skokaina/ark-n8n:$VERSION` and `:latest`

### helm.yml

**Triggers**: Tags (v*), manual dispatch
**Steps**:
1. Update Chart.yaml version from tag
2. Package Helm chart (`helm package chart/`)
3. Push to `oci://ghcr.io/skokaina/charts/ark-n8n`

## Versioning Strategy

Use semantic versioning (SemVer):

- `v0.0.1` - Initial release
- `v0.1.0` - Minor feature additions
- `v1.0.0` - Stable API, production-ready
- `v1.0.1` - Patch/bugfix

**Releasing**:
```bash
git tag v0.0.2
git push origin v0.0.2
```

This triggers build.yml + helm.yml workflows.

## Testing Custom Nodes Locally

### Manual Testing in n8n UI

1. Start DevSpace: `devspace dev`
2. Open n8n: http://localhost:5678
3. Create new workflow
4. Search for "ARK" nodes in node palette
5. Configure ARK API credentials
6. Test node execution

### Automated Testing

Tests are in `nodes/nodes/*/tests__/`:

```typescript
import { ArkAgent } from '../ArkAgent.node';
import { createMockExecuteFunctions } from '../../../test-helpers/mocks';

describe('ArkAgent', () => {
  it('executes agent query successfully', async () => {
    const mockFunctions = createMockExecuteFunctions({
      /* mock data */
    });

    const node = new ArkAgent();
    const result = await node.execute.call(mockFunctions);

    expect(result[0][0].json).toHaveProperty('response');
  });
});
```

## Debugging

### View n8n logs

```bash
kubectl logs deployment/ark-n8n -f
```

### Check custom nodes are loaded

```bash
kubectl exec -it deployment/ark-n8n -- npm list -g n8n-nodes-ark
kubectl exec -it deployment/ark-n8n -- env | grep N8N_CUSTOM_EXTENSIONS
```

### Test ARK API connectivity

```bash
kubectl exec -it deployment/ark-n8n -- curl http://ark-api.default.svc.cluster.local:8000/v1/agents
```

## ARK Agent Advanced Node

### Overview

The **ARK Agent Advanced** node extends the basic ARK Agent with support for:
- **Memory and Session Management**: Maintain conversation history across multiple queries
- **Dynamic Configuration**: Update agent model and tools from connected n8n sub-nodes
- **Sub-Node Connections**: Connect Chat Model, Memory, and Tool nodes from n8n's AI ecosystem

### Configuration Modes

#### Static Mode (Recommended for Production)
Use pre-configured ARK agents without modification. This is faster and safer for production workflows.

```yaml
# Agent already configured in ARK
apiVersion: ark.mckinsey.com/v1alpha1
kind: Agent
metadata:
  name: support-agent
spec:
  modelRef:
    name: gpt-4
  tools:
    - type: builtin
      name: web-search
  prompt: "You are a helpful support agent..."
```

**Node Configuration**:
- Configuration Mode: "Use Pre-configured Agent"
- Agent: Select from dropdown
- Memory: Select ARK Memory CRD
- Session ID: User-provided or auto-generated

#### Dynamic Mode (For Experimentation)
Update agent configuration at runtime from connected n8n sub-nodes.

**Workflow**:
1. Connect OpenAI/Anthropic Model node
2. Connect Tool nodes (web search, calculator, etc.)
3. Node PATCHes agent with new configuration
4. Executes query with updated agent

**Use Cases**:
- A/B testing different models
- Dynamic tool selection based on workflow logic
- Experimentation without creating new agent CRDs

### Memory and Session Management

ARK handles memory at the **Query level** using Memory CRDs and session IDs.

**Memory CRD Example**:
```yaml
apiVersion: ark.mckinsey.com/v1alpha1
kind: Memory
metadata:
  name: ark-cluster-memory
spec:
  type: buffer
  maxMessages: 20
```

**Session ID Strategies**:

| Strategy | Session ID Example | Use Case |
|----------|-------------------|----------|
| User-specific | `user-{{$json.userId}}-session` | Multi-user chat applications |
| Per-conversation | `conv-{{$json.conversationId}}` | Separate conversation threads |
| Per-execution | Auto-generated | New conversation each workflow run |
| Static (testing) | `test-session-123` | Predictable testing |
| Weekly sessions | `{{$json.userId}}-{{$now.startOf('week')}}` | Reset conversations weekly |

**How it works**:
1. First query with session ID → ARK creates conversation in Memory
2. Subsequent queries with same session ID → ARK retrieves history and appends
3. Different session ID → Fresh conversation

### API Endpoints Used

**Static Mode**:
```
POST /v1/namespaces/{namespace}/queries
{
  spec: {
    input: "User question",
    targets: [{ type: "agent", name: "my-agent" }],
    memory: { name: "ark-cluster-memory", namespace: "default" },
    sessionId: "user-123-session",
    wait: true,
    timeout: "30s"
  }
}
```

**Dynamic Mode**:
```
# 1. Update agent configuration
PATCH /v1/namespaces/{namespace}/agents/{name}
{
  spec: {
    modelRef: { name: "gpt-4-turbo", namespace: "default" },
    tools: [
      { type: "builtin", name: "web-search" },
      { type: "custom", name: "calculator" }
    ]
  }
}

# 2. Execute query (same as static mode)
POST /v1/namespaces/{namespace}/queries
{...}
```

### Example Workflows

**1. Persistent Chat Session**:
```
Webhook Trigger (receives userId and message)
  ↓
ARK Agent Advanced
  - Session ID: "={{$json.userId}}-chat"
  - Memory: "ark-cluster-memory"
  - Agent: "support-agent"
  - Input: "={{$json.message}}"
  ↓
HTTP Response (send agent reply)
```

**2. Dynamic Model Testing**:
```
OpenAI Model (GPT-4) ──┐
                       │
Calculator Tool ───────┼──→ ARK Agent Advanced
                       │     - Configuration Mode: "Dynamic"
Web Search Tool ───────┘     - Session ID: (empty, auto-generated)
                             - Input: "Solve complex problem"
```

**3. Multi-turn Conversation**:
```
Loop over user messages
  ↓
ARK Agent Advanced
  - Session ID: "={{$json.conversationId}}" (fixed for entire loop)
  - Memory: "ark-cluster-memory"
  - Agent: "qa-agent"
  - Input: "={{$item.message}}"
  ↓
Store responses in database
```

### Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Configuration Mode | Dropdown | Yes | Static or Dynamic |
| Agent | Dropdown | Yes | ARK agent to execute |
| Input | String | Yes | User query/prompt |
| Memory | Dropdown | No | ARK Memory CRD reference |
| Session ID | String | No | Unique session identifier (auto-generates if empty) |
| Wait for Completion | Boolean | Yes | Wait for response or run async |
| Timeout | String | Yes | Max wait time (e.g., "30s", "5m") |

### Output Structure

```json
{
  "queryName": "n8n-support-agent-1234567890",
  "status": "completed",
  "input": "What did we discuss earlier?",
  "response": "We discussed ARK custom nodes and memory management.",
  "duration": "2.5s",
  "sessionId": "user-123-session",
  "memoryRef": "ark-cluster-memory",
  "agentName": "support-agent"
}
```

### Credential Configuration

**ARK API Credentials**:
- **Base URL**: ARK API service endpoint (e.g., `http://ark-api.default.svc.cluster.local`)
- **Namespace**: Kubernetes namespace for ARK resources (default: `default`)
- **API Key**: Optional authentication (format: `pk-ark-xxx:sk-ark-xxx`)

### Best Practices

1. **Use Static Mode for Production**: Pre-configure agents in ARK, use static mode in workflows
2. **Session ID Management**: Use expressions for dynamic session IDs (e.g., user-based)
3. **Memory Cleanup**: Configure Memory CRDs with appropriate `maxMessages` or expiration
4. **Error Handling**: Wrap node in try/catch or use n8n's error workflows
5. **Testing**: Use static session IDs for reproducible test conversations
6. **Performance**: Static mode is faster (no PATCH call), use for high-throughput workflows

## Contributing Guidelines

### Adding New Nodes

1. Create node file: `nodes/nodes/NewNode/NewNode.node.ts`
2. Implement `INodeType` interface with `description` and `execute()`
3. Add icon: `nodes/nodes/NewNode/new-node.svg`
4. Export in `nodes/package.json`:
   ```json
   "n8n": {
     "nodes": [
       "dist/nodes/NewNode/NewNode.node.js"
     ]
   }
   ```
5. Write tests: `nodes/nodes/NewNode/__tests__/NewNode.node.test.ts`
6. Build and test locally

### Code Style

- Use TypeScript strict mode
- Follow existing patterns (see ArkAgent.node.ts as reference)
- Add JSDoc comments for complex logic
- Keep methods focused and testable
- Use n8n workflow helpers (`this.helpers.request`, etc.)

## Troubleshooting

### Build failures

- Ensure nodes are built before Docker: `cd nodes && npm run build`
- Check TypeScript compilation: `npx tsc --noEmit`
- Verify package.json exports match dist/ structure

### Nodes not appearing

- Confirm N8N_CUSTOM_EXTENSIONS env var is set
- Check npm install -g succeeded in Dockerfile
- Verify package.json `n8n.nodes` array includes all nodes

### ARK API errors

- Confirm ARK cluster is running and accessible
- Verify `ark.apiUrl` in Helm values is correct
- Test connectivity from n8n pod (see Debugging section)

## Maintenance

### Sync with main ARK repo

This standalone repo is independent but may need updates when ARK API changes:

1. Watch main ARK repo for API contract changes
2. Update node implementations if needed
3. Update tests to reflect new API behavior
4. Tag new version and release

### Updating n8n base image

Update Dockerfile:
```dockerfile
ARG N8N_VERSION=1.x.x  # Specific version
```

Test compatibility with ARK nodes before releasing.
