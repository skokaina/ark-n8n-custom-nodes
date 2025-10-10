# Smart Customer Support with AI Quality Gates - Demo Setup

This directory contains all the resources needed to run the example workflow for the Medium article.

## Quick Start

### 1. Deploy ARK Resources

```bash
# From the ark-oss root directory
kubectl apply -f services/n8n/article/01-agent.yaml
kubectl apply -f services/n8n/article/02-evaluator.yaml

# Wait for resources to be ready
kubectl wait --for=condition=ready agent/support-agent --timeout=60s
kubectl wait --for=condition=ready evaluator/support-quality-evaluator --timeout=60s
```

### 2. Import n8n Workflow

1. Open n8n: http://n8n.default.127.0.0.1.nip.io:8080
2. Click "+" to create new workflow
3. Click the three dots (⋯) in top-right
4. Select "Import from File"
5. Choose `n8n-workflow.json`
6. Configure credentials:
   - **ARK API**: Use `http://ark-api.default.svc.cluster.local` as base URL
   - **Slack API** (optional): Add your Slack webhook/token

### 3. Test the Workflow

#### Test Data (High Quality Response Expected)

```bash
curl -X POST http://ark-n8n.default.127.0.0.1.nip.io:8080/webhook/customer-support \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Alice Johnson",
    "customer_email": "alice@example.com",
    "account_type": "Enterprise",
    "priority": "high",
    "issue": "I cannot access the API dashboard. When I try to log in, I get a 403 error. I have verified my credentials are correct."
  }'
```

**Expected Result**: Quality score ≥ 0.8 → Auto-sent to customer ✅

#### Test Data (Low Quality Response Expected)

```bash
curl -X POST http://ark-n8n.default.127.0.0.1.nip.io:8080/webhook/customer-support \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Bob Smith",
    "customer_email": "bob@example.com",
    "account_type": "Free",
    "priority": "low",
    "issue": "Why is everything broken?"
  }'
```

**Expected Result**: Vague question may result in lower score → Queued for review ⚠️

## Workflow Overview

```
Webhook Trigger
    ↓
ARK Agent (support-agent)
    ↓ (generates response)
ARK Evaluation (support-quality-evaluator)
    ↓ (scores: relevance, accuracy, clarity, usefulness, compliance)
IF: Score >= 0.8
    ├─ TRUE → Send to Customer → Slack Notify
    └─ FALSE → Add to Review Queue → Slack Alert
```

## Key Features Demonstrated

### 1. ARK Agent Node
- **Agent Selection**: Choose from dropdown of available agents
- **Input Mapping**: Use expressions to compose context-rich prompts
- **Wait Mode**: Synchronous execution with timeout

### 2. ARK Evaluation Node
- **Evaluation Type**: Direct (input/output evaluation)
- **Evaluator Selection**: Choose from dropdown of available evaluators
- **Advanced Parameters**:
  - `scope`: Multi-dimensional quality assessment
  - `minScore`: Threshold for quality gates
  - `temperature`: Evaluation consistency (0.1 = strict)
  - `context`: Additional evaluation criteria

### 3. Quality-Based Routing
- **Decision Point**: IF node checks evaluation score
- **High Quality Path**: Auto-send + notify team
- **Low Quality Path**: Queue for review + alert supervisor

## Troubleshooting

### Agent not found
```bash
kubectl get agent support-agent
# If not ready, check logs:
kubectl logs -n ark-system deployment/ark-controller-manager
```

### Evaluator not available
```bash
kubectl get evaluator support-quality-evaluator
# Check if model is ready:
kubectl get model default
```

### n8n cannot connect to ARK API
- Ensure ARK API credentials use: `http://ark-api.default.svc.cluster.local`
- Check ARK API is running: `kubectl get svc ark-api`

### Webhook not responding
- Check workflow is active (toggle in n8n UI)
- Verify webhook path: `http://ark-n8n.default.127.0.0.1.nip.io:8080/webhook/customer-support`

