# E2E Test Fixtures

## ARK Resources (ark-resources.yaml)

Test resources for real ARK integration:

- **test-agent** - Simple agent for testing basic functionality
- **test-model** - OpenAI GPT-3.5-turbo model reference
- **test-team** - Multi-agent team with sequential orchestration
- **test-memory** - Buffer memory with 20 message limit
- **test-evaluator** - Quality evaluator with accuracy and relevance dimensions

These resources are automatically applied when running `make e2e-setup`.

## Demo Workflow (demo-workflow.json)

Sample n8n workflow that exercises all ARK custom nodes:

- Manual Trigger
- ARK Agent
- ARK Model
- ARK Team
- ARK Evaluation

Can be imported into n8n for manual testing.

## Mock ARK API (Deprecated)

`mock-ark-api.yaml` is kept for reference but **no longer used** in E2E tests.

We now use **real ARK 0.1.51** for authentic integration testing.

**Benefits of real ARK:**
- Tests actual API behavior
- Catches breaking changes
- Validates CRD interactions
- More confidence in production deployments

**If you need the mock for offline development:**
```bash
kubectl apply -f e2e/fixtures/mock-ark-api.yaml
# Use ark.apiUrl=http://mock-ark-api.ark-system.svc.cluster.local:8000
```
