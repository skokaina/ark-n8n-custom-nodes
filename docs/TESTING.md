# ARK n8n E2E Tests

End-to-end testing suite for ARK n8n custom nodes using Playwright.

## Overview

This E2E test suite validates that:
- All ARK custom nodes load correctly in n8n
- Nodes can be configured and connected
- Workflows execute successfully
- Integration with ARK API works as expected

## Quick Start

### Prerequisites

- Docker
- kubectl
- k3d (installed automatically by test workflow)
- Node.js 22+

### Run E2E Tests Locally

**Option 1: Using Make (Recommended)**

```bash
# Setup complete E2E environment
make e2e-setup

# Run tests
make e2e

# Cleanup when done
make e2e-cleanup
```

**Option 2: Manual Setup**

```bash
# 1. Install dependencies
cd e2e
npm install
npx playwright install --with-deps chromium

# 2. Setup k3d cluster
k3d cluster create ark-test --agents 2 --port "5678:5678@loadbalancer"

# 3. Install ARK 0.1.51 (with gateway)
npm install -g @agents-at-scale/ark@0.1.51
ark install --yes --wait-for-ready 5m  # Installs gateway automatically

# 4. Create test resources
kubectl apply -f e2e/fixtures/ark-resources.yaml

# 5. Build and deploy ark-n8n
cd ..
docker build -t ark-n8n:test .
k3d image import ark-n8n:test -c ark-test

helm install ark-n8n ./chart \
  --set app.image.repository=ark-n8n \
  --set app.image.tag=test \
  --set app.image.pullPolicy=Never \
  --set ark.apiUrl=http://ark-api.default.svc.cluster.local \
  --set httpRoute.enabled=false

# 6. Port forward
kubectl port-forward svc/ark-n8n 5678:5678 &

# 7. Run tests
cd e2e
npx playwright test
```

## Test Structure

```
e2e/
├── fixtures/
│   ├── ark-resources.yaml      # Test ARK resources (agents, models, teams, etc.)
│   └── demo-workflow.json      # Sample workflow with all ARK nodes
├── scripts/
│   └── import-workflow.js      # Script to load workflows into n8n
├── tests/
│   └── ark-nodes.spec.ts       # Main E2E test suite
├── package.json
├── playwright.config.ts
└── README.md
```

## Real ARK Installation

The E2E tests install **real ARK 0.1.51** for authentic integration testing:
- Full ARK cluster with API server and orchestrator
- Real CRDs: Agents, Models, Teams, Memories, Evaluators
- Authentic API endpoints and behavior
- Same experience as production deployments

**ARK Version:** 0.1.51 (pinned for reproducibility)

**Installation method:**
- Uses `@agents-at-scale/ark` npm package (CLI)
- `ark install` deploys all components to Kubernetes

**Components installed:**
- `ark-api` - REST API server
- `ark-controller` - CRD controller
- `ark-dashboard` - Web UI (optional)
- ARK CRDs - Custom resource definitions

**Test resources created (e2e/fixtures/ark-resources.yaml):**
- `test-agent` - Sample agent for testing
- `test-model` - OpenAI GPT-3.5-turbo reference
- `test-team` - Multi-agent team configuration
- `test-memory` - Buffer memory (20 messages)
- `test-evaluator` - Quality evaluation dimensions

**Why real ARK instead of mocks?**
- Tests actual API contracts and behavior
- Catches breaking changes in ARK
- Validates real-world integration scenarios
- More confidence in production deployments

## Tests Included

### 1. UI Loading Tests
- n8n UI loads successfully
- Canvas is visible and interactive

### 2. Credential Tests
- ARK API credentials can be configured
- Credential appears in settings

### 3. Node Availability Tests
- All ARK nodes appear in node palette:
  - ARK Agent
  - ARK Agent Advanced
  - ARK Model
  - ARK Team
  - ARK Evaluation

### 4. Node Configuration Tests
- Nodes can be added to canvas
- Parameter fields are present and correct
- Advanced nodes show memory and session fields

### 5. Workflow Execution Tests
- Workflows with ARK nodes execute successfully
- No errors during execution
- Proper status indicators

## CI/CD Integration

The E2E tests run automatically on:
- Pull requests to main
- Pushes to main
- Nightly schedule (2 AM UTC)
- Manual workflow dispatch

**GitHub Actions Workflow**: `.github/workflows/e2e.yml`

## Viewing Test Results

### Local Development

```bash
# Run with UI mode
make e2e-ui

# Or manually
cd e2e
npx playwright test --ui
```

### CI Artifacts

When tests run in GitHub Actions:
- HTML reports are uploaded as artifacts
- Screenshots/videos available for failed tests
- Traces available for debugging

**Download artifacts:**
1. Go to GitHub Actions run
2. Scroll to "Artifacts" section
3. Download "playwright-report"
4. Extract and open `index.html`

## Debugging Failed Tests

### Check n8n logs

```bash
kubectl logs deployment/ark-n8n --tail=100
```

### Check ARK logs

```bash
# ARK Controller logs
kubectl logs deployment/ark-controller -n ark-system --tail=100
```

### Run tests with debug mode

```bash
cd e2e
npx playwright test --debug
```

### Access n8n UI manually

```bash
kubectl port-forward svc/ark-n8n 5678:5678
# Open http://localhost:5678 in browser
```

## Extending Tests

### Adding New Test Cases

Edit `tests/ark-nodes.spec.ts`:

```typescript
test('my new test', async ({ page }) => {
  await page.goto('/');
  // Your test logic
  await expect(page.locator('...')).toBeVisible();
});
```

### Adding New Workflows

Add workflow JSON to `fixtures/` and import via script:

```javascript
// scripts/import-workflow.js
const workflow = require('../fixtures/my-workflow.json');
// Import logic
```

### Updating Mock API Responses

Edit `fixtures/mock-ark-api.yaml` ConfigMap:

```yaml
data:
  my-endpoint.json: |
    {
      "items": [...]
    }
```

## Makefile Commands

| Command | Description |
|---------|-------------|
| `make e2e-setup` | Setup k3d cluster and deploy everything |
| `make e2e` | Run E2E tests |
| `make e2e-ui` | Run tests with Playwright UI |
| `make e2e-cleanup` | Delete k3d cluster |

## Tips

1. **Use k3d for local testing** - Fast, lightweight, disposable clusters
2. **Mock ARK API is sufficient** - No need for full ARK installation
3. **Single worker mode** - Playwright runs sequentially for n8n (avoid race conditions)
4. **Artifacts on failure** - Always check screenshots/videos for debugging
5. **Nightly runs** - Catch regressions early with scheduled tests

## Troubleshooting

### Tests timeout

- Increase timeout in `playwright.config.ts`:
  ```typescript
  timeout: 120000, // 2 minutes
  ```

### n8n not ready

- Check pod status: `kubectl get pods`
- View logs: `kubectl logs deployment/ark-n8n`
- Increase wait timeout in workflow

### Port forward issues

- Kill existing port forwards: `pkill -f "port-forward"`
- Check port availability: `lsof -i :5678`

### Mock API not responding

- Restart deployment: `kubectl rollout restart deployment/mock-ark-api -n ark-system`
- Check logs: `kubectl logs deployment/mock-ark-api -n ark-system`

## Free Cloud Testing Options

While GitHub Actions provides 2000 free minutes/month for public repos (which is sufficient for this project), alternatives include:

1. **GitHub Actions** ✅ (Current choice)
   - Free for public repos
   - k3d works great in runners
   - Artifact storage included

2. **CircleCI**
   - 6000 free minutes/month
   - Good Docker support

3. **GitLab CI**
   - Unlimited free minutes for public repos
   - Built-in k8s support

**Recommendation**: Stick with GitHub Actions for simplicity and integration.
