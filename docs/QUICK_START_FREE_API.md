# Quick Start: FREE API for E2E Testing

**Setup time: 30 seconds** | **No credit card required** | **$0 cost**

## Local Testing (Use Your Existing Token)

### Option 1: Export Environment Variable (Recommended)

```bash
# Set your HuggingFace token
export HF_API_TOKEN="hf_YOUR_TOKEN_HERE"

# Run setup (will automatically use HF_API_TOKEN)
make e2e-ark-free-api

# Expected output:
# ✓ Found HF_API_TOKEN environment variable
# ✓ Using HuggingFace API automatically
# ✅ HuggingFace API configured from HF_API_TOKEN!
```

### Option 2: Add to Shell Profile (Permanent)

```bash
# Add to ~/.zshrc or ~/.bashrc
echo 'export HF_API_TOKEN="hf_YOUR_TOKEN_HERE"' >> ~/.zshrc

# Reload shell
source ~/.zshrc

# Now it's always available
make e2e-ark-free-api
```

### Option 3: One-Line Setup

```bash
HF_API_TOKEN="hf_YOUR_TOKEN" make e2e-ark-free-api
```

---

## GitHub Actions / CI/CD

### 1. Add Secret to Repository

```
GitHub Repository → Settings → Secrets and variables → Actions
→ New repository secret

Name: HF_API_TOKEN
Value: hf_YOUR_TOKEN_HERE
```

### 2. Done!

The workflow automatically uses `HF_API_TOKEN` secret. No code changes needed.

---

## Verify It Works

```bash
# Check secret was created
kubectl get secret huggingface-api-key -n default

# Check model was created
kubectl get model test-model -n default

# Check agent was created
kubectl get agent test-agent -n default

# Test with a query
kubectl run test-query --rm -i --restart=Never --image=curlimages/curl -- \
  curl -X POST http://ark-api.ark-system.svc.cluster.local/v1/namespaces/default/queries \
    -H 'Content-Type: application/json' \
    -d '{
      "spec": {
        "input": "What is 2+2?",
        "targets": [{"type": "agent", "name": "test-agent"}],
        "wait": true
      }
    }'
```

---

## Get Your FREE Token (If You Don't Have One)

1. Go to: https://huggingface.co/settings/tokens
2. Click "New token"
3. Name: `ark-e2e-testing`
4. Role: `Read` (free tier)
5. Click "Generate"
6. Copy token: `hf_...`

**No credit card required!**

---

## Alternative Providers (If You Prefer)

### Groq (Fastest)

```bash
export GROQ_API_KEY="gsk_YOUR_KEY"
make e2e-ark-free-api
# Choose option 2
```

Get key: https://console.groq.com/keys

### OpenRouter

```bash
export OPENROUTER_API_KEY="sk-or-YOUR_KEY"
make e2e-ark-free-api
# Choose option 3
```

Get key: https://openrouter.ai/keys

---

## Comparison with Ollama

```
HuggingFace API:
  ✅ Setup: 30 seconds
  ✅ Image size: 0 bytes
  ✅ CI/CD: Perfect (just secret)
  ✅ Cost: $0

Ollama:
  ⏱️  Setup: 5-10 minutes
  💾 Image size: 5.49GB
  ❌ CI/CD: Slow (large image)
  ✅ Cost: $0
```

---

## Troubleshooting

### "HF_API_TOKEN not found"

```bash
# Check if set
echo $HF_API_TOKEN

# If empty, set it
export HF_API_TOKEN="hf_YOUR_TOKEN"
```

### "Secret already exists"

```bash
# Delete and recreate
kubectl delete secret huggingface-api-key
make e2e-ark-free-api
```

### Rate Limit Exceeded

HuggingFace free tier is very generous (~1000 requests/hour).
If you hit limits:
- Wait 1 hour
- Use different model
- Upgrade to Pro ($9/month)

---

## Full E2E Test

```bash
# 1. Export token
export HF_API_TOKEN="hf_YOUR_TOKEN"

# 2. Setup E2E environment
make e2e-setup

# 3. Run webhook test
make e2e-webhook

# Done! 🎉
```

---

**Time:** 30 seconds setup + 10-20 seconds test = **~1 minute total**

Compare to Ollama: 5-10 minutes setup + 10-20 seconds test = **~10 minutes total**
