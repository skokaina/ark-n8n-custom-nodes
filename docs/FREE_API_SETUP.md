# Free API Setup for E2E Testing

Quick guide to use free LLM APIs instead of Ollama for E2E testing. **No credit card required!**

## Why Use Free APIs Instead of Ollama?

| Aspect | Ollama (Local) | Free APIs |
|--------|----------------|-----------|
| **Setup Time** | 5-10 minutes (image pull) | 30 seconds |
| **Image Size** | 5.49GB | 0 bytes |
| **First Run** | Very slow | Instant |
| **CI/CD** | Slow, large cache | Fast, small secret |
| **Cost** | $0 | $0 |
| **Inference Speed** | Medium | Fast (Groq) / Medium (HF) |

**Recommendation**: Use **Free APIs for CI/CD**, Ollama for local development if desired.

---

## Option 1: HuggingFace (Recommended for CI/CD)

### Why HuggingFace?
- ✅ **Truly free** - No credit card required
- ✅ **300+ models** available
- ✅ **Generous rate limits** for testing
- ✅ **Instant setup** - Just create token
- ✅ **Reliable** - Backed by HuggingFace infrastructure

### Get Free API Key (30 seconds)

1. Go to [HuggingFace Settings](https://huggingface.co/settings/tokens)
2. Click "New token"
3. Name it: `ark-e2e-testing`
4. Role: `Read` (free tier)
5. Click "Generate"
6. Copy the token: `hf_...`

### Setup in Kubernetes

```bash
# Create secret
kubectl create secret generic huggingface-api-key \
  --from-literal=api-key='hf_YOUR_TOKEN_HERE'

# Apply ARK resources
kubectl apply -f e2e/fixtures/ark-free-api-resources.yaml

# Verify
kubectl get models,agents -n default
```

### GitHub Actions Setup

Add to repository secrets:
```
Settings → Secrets and variables → Actions → New repository secret

Name: HUGGINGFACE_API_KEY
Value: hf_YOUR_TOKEN_HERE
```

Update `.github/workflows/e2e.yml`:
```yaml
- name: Setup HuggingFace API Key
  run: |
    kubectl create secret generic huggingface-api-key \
      --from-literal=api-key='${{ secrets.HUGGINGFACE_API_KEY }}'
```

---

## Option 2: Groq (Fastest Inference)

### Why Groq?
- ✅ **Blazing fast** - 500+ tokens/sec
- ✅ **Free tier** - 1000 requests/day
- ✅ **No credit card** required
- ✅ **OpenAI-compatible** API

### Get Free API Key

1. Go to [Groq Console](https://console.groq.com/keys)
2. Sign up (free, no credit card)
3. Create new API key
4. Copy the key: `gsk_...`

### Setup in Kubernetes

```bash
# Create secret
kubectl create secret generic groq-api-key \
  --from-literal=api-key='gsk_YOUR_KEY_HERE'

# Update ARK resources to use Groq model
kubectl apply -f e2e/fixtures/ark-free-api-resources.yaml

# Change test-agent to use groq-model
kubectl patch agent test-agent -n default --type=merge -p '{"spec":{"modelRef":{"name":"groq-model"}}}'
```

---

## Option 3: OpenRouter (Model Aggregator)

### Why OpenRouter?
- ✅ **Free model router** - Automatically selects from free models
- ✅ **Multiple providers** in one
- ✅ **OpenAI-compatible**
- ✅ **No credit card** required

### Get Free API Key

1. Go to [OpenRouter Keys](https://openrouter.ai/keys)
2. Sign up (free)
3. Create new key
4. Copy: `sk-or-...`

### Setup in Kubernetes

```bash
# Create secret
kubectl create secret generic openrouter-api-key \
  --from-literal=api-key='sk-or-YOUR_KEY_HERE'

# Apply resources
kubectl apply -f e2e/fixtures/ark-free-api-resources.yaml
```

---

## Comparison of Free Options

| Provider | Speed | Rate Limit | Models | Setup Time |
|----------|-------|------------|--------|------------|
| **HuggingFace** | Medium | Very generous | 300+ | 30s |
| **Groq** | ⚡ Very fast | 1000 req/day | 10+ | 30s |
| **OpenRouter** | Medium | Varies by model | Free router | 30s |
| **Ollama** | Medium | Unlimited | Any | 10min first run |

---

## Complete Setup Script

```bash
#!/bin/bash

# Choose your provider
PROVIDER="huggingface"  # or "groq" or "openrouter"

# Set your API key
case $PROVIDER in
  huggingface)
    read -sp "Enter HuggingFace API key (hf_...): " API_KEY
    kubectl create secret generic huggingface-api-key --from-literal=api-key="$API_KEY"
    ;;
  groq)
    read -sp "Enter Groq API key (gsk_...): " API_KEY
    kubectl create secret generic groq-api-key --from-literal=api-key="$API_KEY"
    kubectl patch agent test-agent -n default --type=merge -p '{"spec":{"modelRef":{"name":"groq-model"}}}'
    ;;
  openrouter)
    read -sp "Enter OpenRouter API key (sk-or-...): " API_KEY
    kubectl create secret generic openrouter-api-key --from-literal=api-key="$API_KEY"
    kubectl patch agent test-agent -n default --type=merge -p '{"spec":{"modelRef":{"name":"default"}}}'
    ;;
esac

echo ""
echo "✅ API key configured!"
echo ""

# Apply ARK resources
kubectl apply -f e2e/fixtures/ark-free-api-resources.yaml

echo "✅ ARK resources created!"
echo ""
echo "Test it:"
echo "  kubectl get models,agents -n default"
```

---

## Testing the Setup

### Quick Test

```bash
# Check resources
kubectl get models,agents,teams,memories -n default

# Test via n8n workflow
kubectl port-forward svc/ark-n8n-proxy 8080:80 &
curl -X POST http://localhost:8080/webhook/ark-test \
  -H 'Content-Type: application/json' \
  -d '{"agent": "test-agent", "query": "What is 2+2?"}'

# Check Query CRD
kubectl get queries -n default
```

### Verify Model Works

```bash
# Get model status
kubectl get model test-model -n default -o yaml

# Check if agent can access model
kubectl get agent test-agent -n default -o yaml
```

---

## Rate Limits and Quotas

### HuggingFace Free Tier
- **Requests**: ~1000/hour (generous)
- **Models**: 300+ available
- **Best for**: CI/CD, extensive testing

### Groq Free Tier
- **Requests**: 1000/day
- **Tokens**: 6000/minute
- **Speed**: 500+ tokens/sec
- **Best for**: Fast E2E tests

### OpenRouter Free Tier
- **Requests**: Varies by model
- **Models**: Automatic free model selection
- **Best for**: Flexibility

---

## Troubleshooting

### API Key Not Working

```bash
# Check secret exists
kubectl get secret huggingface-api-key -n default

# Verify secret content (base64 encoded)
kubectl get secret huggingface-api-key -o yaml

# Delete and recreate
kubectl delete secret huggingface-api-key
kubectl create secret generic huggingface-api-key \
  --from-literal=api-key='hf_YOUR_NEW_KEY'
```

### Model Not Found Error

```bash
# Check model is created
kubectl get model test-model -n default

# Check model provider is correct
kubectl get model test-model -n default -o yaml | grep provider
```

### Rate Limit Exceeded

If you hit rate limits:
1. **HuggingFace**: Upgrade to Pro ($9/month) or use multiple keys
2. **Groq**: Wait for daily reset or upgrade
3. **Switch providers**: Use OpenRouter as fallback

---

## GitHub Actions Best Practice

Store API key in GitHub Secrets and create secret in workflow:

```yaml
jobs:
  e2e-test:
    steps:
      - name: Setup Free API
        env:
          HF_API_KEY: ${{ secrets.HUGGINGFACE_API_KEY }}
        run: |
          # Create secret from GitHub Actions secret
          kubectl create secret generic huggingface-api-key \
            --from-literal=api-key="$HF_API_KEY"

          # Apply resources
          kubectl apply -f e2e/fixtures/ark-free-api-resources.yaml

          echo "✅ Free API configured (HuggingFace)"
```

**No more 5GB image downloads in CI/CD!** 🎉

---

## Sources

- [15 Free LLM APIs You Can Use in 2026](https://www.analyticsvidhya.com/blog/2026/01/top-free-llm-apis/)
- [Free LLM API Resources](https://github.com/cheahjs/free-llm-api-resources)
- [Best Free LLM API Services 2025](https://intelligentwebdevelopers.com/web-development/best-free-llm-api-services-for-ai-agents-in-2025-complete-developer-guide/)
- [Groq on Hugging Face](https://huggingface.co/blog/inference-providers-groq)
- [OpenRouter Free Models](https://openrouter.ai/collections/free-models)
- [ARK Documentation](https://mckinsey.github.io/agents-at-scale-ark/)

---

**Recommendation for CI/CD**: Use **HuggingFace** (most reliable, generous limits, truly free) or **Groq** (fastest inference).
