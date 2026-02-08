# Ollama-Based E2E Testing

Complete guide for using Ollama with ARK custom nodes for E2E testing without requiring external API keys.

## Overview

We use [Ollama](https://ollama.com/) to run local LLM models for E2E testing, eliminating the need for:
- ❌ OpenAI API keys
- ❌ Anthropic API keys
- ❌ External API dependencies
- ❌ Rate limits or costs

Instead, we get:
- ✅ Fast, local model inference
- ✅ No API keys required
- ✅ Reproducible test results
- ✅ Works in CI/CD (GitHub Actions)
- ✅ Free and open source

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  k3d Kubernetes Cluster                   │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Ollama Deployment (ollama namespace)            │    │
│  │                                                   │    │
│  │  • Model: qwen2.5:0.5b (smallest, ~397MB)       │    │
│  │  • Service: ollama.ollama.svc.cluster.local     │    │
│  │  • No API keys needed                            │    │
│  └──────────────────────┬───────────────────────────┘    │
│                         │                                 │
│  ┌──────────────────────▼───────────────────────────┐    │
│  │  ARK Model CRD                                    │    │
│  │                                                   │    │
│  │  provider: ollama                                │    │
│  │  model: qwen2.5:0.5b                             │    │
│  │  baseUrl: http://ollama.ollama.svc.cluster.local│    │
│  └──────────────────────┬───────────────────────────┘    │
│                         │                                 │
│  ┌──────────────────────▼───────────────────────────┐    │
│  │  ARK Agents                                       │    │
│  │                                                   │    │
│  │  • test-agent (general purpose)                  │    │
│  │  • math-agent (math problems)                    │    │
│  └──────────────────────┬───────────────────────────┘    │
│                         │                                 │
│  ┌──────────────────────▼───────────────────────────┐    │
│  │  n8n with ARK Custom Nodes                        │    │
│  │                                                   │    │
│  │  Workflow → ARK Agent Node → Query ARK API       │    │
│  └───────────────────────────────────────────────────┘    │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

## Model Selection: qwen2.5:0.5b

We use **qwen2.5:0.5b** as our test model for these reasons:

| Metric | Value | Why It Matters |
|--------|-------|----------------|
| **Size** | 397 MB | Fast downloads in CI/CD |
| **Parameters** | 0.5B | Lightweight, fast inference |
| **Speed** | ~50 tokens/sec | E2E tests complete quickly |
| **Quality** | Good for simple tasks | Sufficient for test validation |
| **Support** | Tool calling | Can test ARK tool integration |

**Alternative Models** (if needed):
- `tinyllama:1.1b` - Even smaller (637MB), but less capable
- `qwen2.5:1.5b` - Larger (935MB), better quality
- `llama3.2:1b` - 1.3GB, good balance

## Setup

### Local Development

```bash
# 1. Create E2E environment (includes Ollama setup)
make e2e-setup

# This will:
# - Create k3d cluster
# - Install ARK
# - Deploy Ollama to cluster
# - Pull qwen2.5:0.5b model
# - Create ARK test resources (Model, Agents, Team, Memory, Evaluator)
```

### Manual Setup (if needed)

```bash
# Just setup Ollama and ARK resources (cluster already exists)
make e2e-ark-test-crds

# Or run the script directly
bash e2e/scripts/setup-ollama-and-ark-resources.sh
```

## ARK Resources Created

### 1. Models

Two model resources pointing to Ollama:

```yaml
# test-model
apiVersion: ark.mckinsey.com/v1alpha1
kind: Model
metadata:
  name: test-model
spec:
  provider: ollama
  type: completion
  model:
    value: qwen2.5:0.5b
  config:
    ollama:
      baseUrl:
        value: "http://ollama.ollama.svc.cluster.local"
```

```yaml
# default model (used when agent doesn't specify a model)
apiVersion: ark.mckinsey.com/v1alpha1
kind: Model
metadata:
  name: default
spec:
  provider: ollama
  type: completion
  model:
    value: qwen2.5:0.5b
  config:
    ollama:
      baseUrl:
        value: "http://ollama.ollama.svc.cluster.local"
```

**No API Key Required!** Ollama doesn't need authentication for local deployments.

### 2. Agents

Two test agents for different scenarios:

**test-agent** (general purpose):
```yaml
apiVersion: ark.mckinsey.com/v1alpha1
kind: Agent
metadata:
  name: test-agent
spec:
  modelRef:
    name: test-model
  prompt: |
    You are a helpful test agent for E2E testing.
    Respond concisely to test queries.
    Keep responses under 50 words.
  temperature: 0.7
  maxTokens: 100
```

**math-agent** (specialized):
```yaml
apiVersion: ark.mckinsey.com/v1alpha1
kind: Agent
metadata:
  name: math-agent
spec:
  modelRef:
    name: test-model
  prompt: |
    You are a math assistant.
    Solve math problems accurately and show your work.
    Keep responses concise.
  temperature: 0.3
  maxTokens: 150
```

### 3. Team

Multi-agent team for orchestration testing:

```yaml
apiVersion: ark.mckinsey.com/v1alpha1
kind: Team
metadata:
  name: test-team
spec:
  agents:
    - name: test-agent
    - name: math-agent
  orchestration:
    type: sequential
```

### 4. Memory

Conversation history storage:

```yaml
apiVersion: ark.mckinsey.com/v1alpha1
kind: Memory
metadata:
  name: test-memory
spec:
  type: buffer
  maxMessages: 20
```

### 5. Evaluator

Quality evaluation resource:

```yaml
apiVersion: ark.mckinsey.com/v1alpha1
kind: Evaluator
metadata:
  name: test-evaluator
spec:
  dimensions:
    - name: accuracy
      description: How accurate is the response
      weight: 1.0
    - name: relevance
      description: How relevant is the response
      weight: 0.8
  modelRef:
    name: test-model
```

## Testing Ollama Directly

### Test Ollama is Running

```bash
kubectl get pods -n ollama

# Should show:
# NAME                      READY   STATUS    RESTARTS   AGE
# ollama-xxxxx-xxxxx        1/1     Running   0          5m
```

### Test Ollama API

```bash
# List available models
kubectl run curl-test --image=curlimages/curl:latest --rm -i --restart=Never -- \
  curl http://ollama.ollama.svc.cluster.local/api/tags

# Generate text
kubectl run curl-test --image=curlimages/curl:latest --rm -i --restart=Never -- \
  curl -X POST http://ollama.ollama.svc.cluster.local/api/generate \
    -H 'Content-Type: application/json' \
    -d '{
      "model": "qwen2.5:0.5b",
      "prompt": "What is 2+2?",
      "stream": false
    }'
```

### Test ARK Model

```bash
# Get ARK models
kubectl get models -n default

# Describe test-model
kubectl get model test-model -n default -o yaml
```

## GitHub Actions Integration

### Current Setup (Kubernetes)

Our CI/CD workflow deploys Ollama **inside** the k3d cluster:

```yaml
# .github/workflows/e2e.yml
- name: Setup Ollama and ARK test resources
  run: |
    bash e2e/scripts/setup-ollama-and-ark-resources.sh
```

**Advantages**:
- ✅ Tests real Kubernetes deployment
- ✅ Same environment as production
- ✅ Tests ARK Model CRD configuration
- ✅ Full integration testing

**Disadvantages**:
- ⚠️ Slower (model download inside cluster)
- ⚠️ More resource-intensive

### Alternative: ollama-action (Standalone)

For **non-Kubernetes** LLM testing, use [ollama-action](https://github.com/ai-action/ollama-action):

```yaml
# Example: Test prompts in isolation
name: Test Prompts

on: pull_request

jobs:
  test-prompts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Test math prompt
        uses: ai-action/ollama-action@v2
        id: math
        with:
          model: qwen2.5:0.5b
          prompt: What is 2 + 2?

      - name: Verify response
        run: |
          echo "Response: ${{ steps.math.outputs.response }}"
          # Add assertions here
```

**When to use ollama-action**:
- ✅ Testing prompts before deploying to ARK
- ✅ Validating agent system prompts
- ✅ Quick LLM experiments in CI/CD
- ✅ Non-Kubernetes LLM workflows

**When NOT to use it**:
- ❌ Full ARK integration tests (use our Kubernetes setup)
- ❌ Testing ARK custom nodes (requires full stack)
- ❌ E2E workflow testing (needs n8n + ARK)

## Performance Considerations

### Model Download Time

| Environment | Download Time | Caching |
|-------------|--------------|---------|
| **Local (first time)** | ~2-3 minutes | Persistent |
| **Local (cached)** | 0 seconds | Volume mounted |
| **GitHub Actions (first)** | ~2-3 minutes | Cache enabled |
| **GitHub Actions (cached)** | ~30 seconds | Actions cache |

### Inference Speed

With qwen2.5:0.5b on typical CI/CD runners:

| Task | Time | Notes |
|------|------|-------|
| Simple query | ~2-3 seconds | "What is 2+2?" |
| Math problem | ~3-5 seconds | Multi-step reasoning |
| Long response | ~5-10 seconds | 100+ tokens |

**Total E2E Test Time**: ~10-20 seconds (including n8n workflow execution)

## Troubleshooting

### Ollama Pod Not Starting

```bash
# Check pod status
kubectl get pods -n ollama

# Check events
kubectl describe pod -n ollama

# Check logs
kubectl logs deployment/ollama -n ollama
```

**Common Issues**:
- Insufficient memory (needs 1Gi minimum)
- Image pull timeout (check internet connection)

### Model Not Available

```bash
# Check if model was pulled
kubectl logs job/ollama-pull-model -n ollama

# Manually trigger model pull
kubectl delete job ollama-pull-model -n ollama
kubectl apply -f e2e/fixtures/ollama-deployment.yaml
```

### ARK Model CRD Errors

```bash
# Check model status
kubectl get model test-model -n default -o yaml

# Test Ollama connectivity from ARK
kubectl run curl-test --image=curlimages/curl:latest --rm -i --restart=Never -- \
  curl http://ollama.ollama.svc.cluster.local/api/tags
```

### Slow Inference

If inference is too slow:

1. **Use smaller model**:
   ```yaml
   model:
     value: tinyllama:1.1b  # Faster than qwen2.5:0.5b
   ```

2. **Increase resources**:
   ```yaml
   resources:
     limits:
       cpu: "4000m"
       memory: "8Gi"
   ```

3. **Reduce max tokens**:
   ```yaml
   spec:
     maxTokens: 50  # Faster responses
   ```

## Switching to External LLM Providers

If you want to use real LLM providers (OpenAI, Anthropic), create secret-based models:

### OpenAI

```bash
# Create secret
kubectl create secret generic openai-api-key \
  --from-literal=api-key='sk-...'

# Create model
cat <<EOF | kubectl apply -f -
apiVersion: ark.mckinsey.com/v1alpha1
kind: Model
metadata:
  name: gpt-4o-mini
spec:
  provider: openai
  type: completion
  model:
    value: gpt-4o-mini
  config:
    openai:
      apiKey:
        valueFrom:
          secretKeyRef:
            name: openai-api-key
            key: api-key
EOF
```

### Anthropic

```bash
# Create secret
kubectl create secret generic anthropic-api-key \
  --from-literal=api-key='sk-ant-...'

# Create model
cat <<EOF | kubectl apply -f -
apiVersion: ark.mckinsey.com/v1alpha1
kind: Model
metadata:
  name: claude-sonnet
spec:
  provider: anthropic
  type: completion
  model:
    value: claude-3-5-sonnet-20241022
  config:
    anthropic:
      apiKey:
        valueFrom:
          secretKeyRef:
            name: anthropic-api-key
            key: api-key
EOF
```

**Trade-offs**:
- ✅ Better model quality
- ✅ More reliable responses
- ❌ Requires API keys
- ❌ Costs money
- ❌ Rate limits
- ❌ External dependencies

## Best Practices

### 1. Use Ollama for E2E Tests

Always use Ollama for automated testing:
- No API costs
- No rate limits
- Consistent results
- Fast and reliable

### 2. Use Real LLMs for Manual Testing

When testing manually or in staging:
- Better quality responses
- More realistic user experience
- Can test edge cases

### 3. Model Selection

| Scenario | Recommended Model |
|----------|------------------|
| **CI/CD E2E Tests** | qwen2.5:0.5b (fast, small) |
| **Local Development** | qwen2.5:1.5b (better quality) |
| **Staging/Demo** | GPT-4o-mini or Claude Sonnet |
| **Production** | GPT-4 or Claude Opus |

### 4. Resource Allocation

```yaml
# Ollama pod resources
resources:
  requests:
    cpu: "500m"      # Minimum
    memory: "1Gi"    # Minimum
  limits:
    cpu: "2000m"     # For faster inference
    memory: "4Gi"    # For larger models if needed
```

## References

- [Ollama Official Site](https://ollama.com/)
- [Ollama Library (Models)](https://ollama.com/library)
- [Ollama API Documentation](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [ollama-action GitHub](https://github.com/ai-action/ollama-action)
- [ARK Model Documentation](https://mckinsey.github.io/agents-at-scale-ark/user-guide/models/)
- [Deploying Local AI Agents in Kubernetes](https://www.cloudnativedeepdive.com/deploying-local-ai-agents-in-kubernetes/)

---

**Questions?** See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) or open an issue on GitHub.
