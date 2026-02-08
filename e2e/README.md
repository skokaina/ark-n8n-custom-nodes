# E2E Testing for ARK n8n Custom Nodes

Comprehensive end-to-end testing suite using Playwright to verify ARK custom nodes work correctly in a real n8n environment.

## Overview

The E2E test suite verifies the complete integration:
1. **n8n UI**: Workflow creation, node configuration, execution
2. **ARK Nodes**: Agent, Model, Team, Evaluation node execution
3. **ARK API**: Query creation and execution
4. **Kubernetes**: Query CRD creation and status updates
5. **Data Consistency**: Response matching between n8n and Kubernetes

## Test Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    E2E Test Suite                            │
│                   (Playwright Tests)                         │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌─────────┐   ┌──────────┐   ┌─────────────┐
    │  n8n UI │   │ Webhook  │   │  kubectl    │
    │ Browser │   │  HTTP    │   │  K8s API    │
    └─────────┘   └──────────┘   └─────────────┘
         │               │               │
         │               ▼               │
         │        ┌────────────┐         │
         └───────>│    n8n     │<────────┘
                  │ Workflows  │
                  └──────┬─────┘
                         │
                         ▼
                  ┌────────────┐
                  │  ARK API   │
                  └──────┬─────┘
                         │
                         ▼
                  ┌────────────┐
                  │ K8s Query  │
                  │    CRDs    │
                  └────────────┘
```

## Test Types

### 1. UI-Based Tests (`ark-nodes.spec.ts`)

Tests n8n UI interactions and node palette:
- ✅ n8n loads successfully
- ✅ ARK custom nodes appear in palette
- ✅ Nodes can be dragged to canvas
- ✅ Credentials can be configured
- ✅ Node parameters are editable

**Use Case**: Verify nodes are properly installed and discoverable

### 2. Webhook E2E Tests (`ark-webhook-e2e.spec.ts`) 🎯 **Recommended**

Complete end-to-end workflow execution test:
- ✅ Import workflow via n8n API
- ✅ Configure ARK credentials
- ✅ Activate webhook workflow
- ✅ Execute workflow via HTTP POST
- ✅ Verify response from ARK agent
- ✅ Check Query CRD created in Kubernetes
- ✅ Verify response consistency (webhook ↔ K8s)
- ✅ Confirm execution appears in n8n UI

**Use Case**: Full integration test simulating real user workflow

**Test Flow**:
```
1. Import webhook-test-workflow.json
   ├─ Webhook Trigger (POST /webhook/ark-test)
   ├─ ARK Agent Node (queries test-agent)
   └─ Respond to Webhook (returns JSON response)

2. Configure ARK credentials
   └─ Base URL: http://ark-api.ark-system.svc.cluster.local
   └─ Namespace: default

3. Activate workflow
   └─ Workflow starts listening for webhooks

4. Send HTTP POST request
   POST http://localhost:8080/webhook/ark-test
   {
     "agent": "test-agent",
     "query": "What is 2 plus 2?"
   }

5. Verify response
   {
     "success": true,
     "query": "What is 2 plus 2?",
     "response": "2 plus 2 equals 4",
     "queryName": "n8n-test-agent-1234567890",
     "status": "completed",
     "duration": "2.5s"
   }

6. Check Kubernetes Query CRD
   kubectl get query n8n-test-agent-1234567890 -n default -o yaml
   └─ Verify spec.input matches request
   └─ Verify status.response matches webhook response
   └─ Verify status.state = "completed"

7. Verify in n8n UI
   └─ Navigate to workflow executions
   └─ Confirm successful execution appears
   └─ Check execution data matches webhook response
```

### 3. Concurrent Tests

Tests handling multiple simultaneous requests:
- ✅ 5 concurrent webhook requests
- ✅ All Query CRDs created
- ✅ No race conditions or data corruption

**Use Case**: Load testing and concurrency verification

### 4. Error Handling Tests

Tests graceful failure scenarios:
- ✅ Non-existent agent returns error
- ✅ Timeout handling
- ✅ Invalid input validation

**Use Case**: Robustness and error recovery

## Running Tests

### Quick Start

```bash
# 1. Setup E2E environment (one-time)
make e2e-setup

# 2. Run webhook E2E test (recommended)
make e2e-webhook

# 3. Run all E2E tests
make e2e

# 4. Run with UI (debugging)
make e2e-ui
```

### Manual Test Execution

```bash
# Start port-forward
kubectl port-forward svc/ark-n8n-proxy 8080:80 &

# Run specific test
cd e2e
npx playwright test ark-webhook-e2e.spec.ts

# Run with debugging
npx playwright test ark-webhook-e2e.spec.ts --headed --debug

# Run specific test case
npx playwright test ark-webhook-e2e.spec.ts -g "webhook"
```

### Environment Variables

```bash
N8N_URL=http://localhost:8080              # n8n access URL
ARK_API_URL=http://ark-api...              # ARK API service URL
CLEANUP_QUERIES=false                       # Auto-delete Query CRDs after tests
```

## Test Fixtures

### ARK Resources (`fixtures/ark-resources.yaml`)

Pre-configured ARK resources for testing:
- **test-model**: GPT-3.5-turbo model
- **test-agent**: General-purpose test agent
- **test-team**: Sequential multi-agent team
- **test-memory**: Buffer memory (20 messages)
- **test-evaluator**: Quality evaluation

### Workflows

#### `webhook-test-workflow.json` (Recommended for E2E)
Simple webhook-based workflow:
- Webhook Trigger → ARK Agent → Respond to Webhook
- Accepts JSON payload: `{ "agent": "test-agent", "query": "..." }`
- Returns structured JSON response

#### `demo-workflow.json`
Complex workflow demonstrating all ARK nodes:
- Manual Trigger
- ARK Agent, Model, Team, Evaluation nodes
- Multiple node connections

## Writing New Tests

### Test Template

```typescript
import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

function kubectl(command: string): string {
  return execSync(`kubectl ${command}`, { encoding: 'utf-8' });
}

test.describe('My ARK Test', () => {
  test('should verify ARK functionality', async ({ page, request }) => {
    // 1. Setup: Create ARK resources
    kubectl('apply -f fixtures/my-resources.yaml');

    // 2. Navigate to n8n
    await page.goto('http://localhost:8080/workflow/new');

    // 3. Add and configure nodes
    // ... node interaction code ...

    // 4. Execute workflow
    await page.click('[data-test-id="execute-workflow"]');

    // 5. Verify n8n response
    const result = await page.locator('.execution-result').textContent();
    expect(result).toContain('success');

    // 6. Verify Kubernetes Query CRD
    const queries = kubectl('get queries -n default -o json');
    const queryList = JSON.parse(queries);
    expect(queryList.items.length).toBeGreaterThan(0);

    // 7. Verify response consistency
    const latestQuery = queryList.items[queryList.items.length - 1];
    expect(latestQuery.status.response).toBe(result);
  });
});
```

### Best Practices

1. **Use Fixtures**: Pre-create ARK resources in `fixtures/` directory
2. **Cleanup**: Use `test.afterAll()` to clean up resources
3. **Wait Strategies**: Use `waitFor()` helper for async Kubernetes operations
4. **Debugging**: Add `--headed --debug` flags to see browser interactions
5. **Screenshots**: Playwright automatically captures screenshots on failure
6. **Isolation**: Each test should be independent and repeatable

## Debugging Failed Tests

### Check Test Artifacts

```bash
# View Playwright report
cd e2e
npx playwright show-report

# Screenshots (saved on failure)
ls -la test-results/*/test-failed-*.png

# Videos (if enabled)
ls -la test-results/*/*.webm
```

### Check n8n Logs

```bash
make e2e-logs

# Or directly
kubectl logs deployment/ark-n8n --tail=100
```

### Check ARK Queries

```bash
# List all queries
kubectl get queries -n default

# Inspect specific query
kubectl get query <query-name> -n default -o yaml

# Check query logs
kubectl logs -n ark-system deployment/ark-controller | grep <query-name>
```

### Interactive Debugging

```bash
# Run test with Playwright Inspector
cd e2e
npx playwright test ark-webhook-e2e.spec.ts --debug

# Or use headed mode with slow-mo
npx playwright test --headed --slowMo=1000
```

### Common Issues

**Issue**: n8n not accessible at localhost:8080
**Solution**: Check port-forward is running
```bash
kubectl port-forward svc/ark-n8n-proxy 8080:80 &
curl http://localhost:8080/healthz
```

**Issue**: ARK resources not found
**Solution**: Apply fixtures
```bash
kubectl apply -f e2e/fixtures/ark-resources.yaml
kubectl get agents,models -n default
```

**Issue**: Webhook returns 404
**Solution**: Workflow not activated or webhook path incorrect
```bash
# Check workflow is active
# Check webhook path matches: /webhook/ark-test
```

**Issue**: Query CRD not created
**Solution**: Check ARK controller is running
```bash
kubectl get pods -n ark-system
kubectl logs deployment/ark-controller -n ark-system
```

## CI/CD Integration

### GitHub Actions

The E2E test suite runs automatically on PRs via `.github/workflows/e2e.yml`:

```yaml
- name: Setup E2E Environment
  run: make e2e-setup

- name: Run Webhook E2E Test
  run: make e2e-webhook

- name: Upload Test Results
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: e2e/playwright-report/
```

### Local Pre-Commit Hook

Add to `.git/hooks/pre-push`:
```bash
#!/bin/bash
echo "Running E2E tests before push..."
make e2e-webhook || {
  echo "E2E tests failed. Push aborted."
  exit 1
}
```

## Performance Considerations

### Test Execution Time

- **UI Tests**: ~30-60 seconds (browser automation overhead)
- **Webhook E2E**: ~10-20 seconds (direct HTTP, faster)
- **Full Suite**: ~2-5 minutes (all tests)

### Optimization Tips

1. **Parallel Execution**: Playwright runs tests in parallel by default
   ```bash
   npx playwright test --workers=4
   ```

2. **Reuse Cluster**: Use `make e2e-update` instead of `make e2e-setup` for fast iteration

3. **Selective Tests**: Run only webhook tests for quick verification
   ```bash
   make e2e-webhook  # Fast, comprehensive
   ```

4. **Skip Cleanup**: Set `CLEANUP_QUERIES=false` to inspect Query CRDs after tests

## Test Coverage

Current E2E test coverage:

| Component | Coverage | Tests |
|-----------|----------|-------|
| ARK Agent Node | ✅ 100% | Webhook E2E |
| ARK Model Node | ⚠️ 50% | UI tests only |
| ARK Team Node | ⚠️ 50% | UI tests only |
| ARK Evaluation Node | ⚠️ 50% | UI tests only |
| Webhook Execution | ✅ 100% | Webhook E2E |
| Query CRD Verification | ✅ 100% | Webhook E2E |
| Concurrent Requests | ✅ 100% | Webhook E2E |
| Error Handling | ✅ 100% | Webhook E2E |

**Goal**: Achieve 100% coverage for all nodes by adding dedicated webhook tests for Model, Team, and Evaluation nodes.

## Roadmap

### Short Term
- [ ] Add webhook tests for ARK Model node
- [ ] Add webhook tests for ARK Team node
- [ ] Add webhook tests for ARK Evaluation node
- [ ] Add ARK Agent Advanced tests with memory and session management

### Medium Term
- [ ] Performance benchmarks (latency, throughput)
- [ ] Visual regression tests (screenshot comparisons)
- [ ] Mobile/responsive UI tests
- [ ] Accessibility (a11y) tests

### Long Term
- [ ] Integration with external systems (Slack, Gmail, etc.)
- [ ] Multi-cluster tests (production-like scenarios)
- [ ] Chaos engineering tests (pod failures, network issues)
- [ ] Load tests (1000+ concurrent workflows)

## Contributing

When adding new features or nodes:

1. **Write E2E test first** (TDD approach)
2. **Create fixture** for required ARK resources
3. **Document test** in this README
4. **Update coverage table** with new test
5. **Ensure CI passes** before merging

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [n8n API Documentation](https://docs.n8n.io/api/)
- [ARK API Documentation](https://github.com/agents-at-scale/ark)
- [Kubernetes Testing Best Practices](https://kubernetes.io/docs/tasks/debug/)

---

**Questions or Issues?** See `docs/TROUBLESHOOTING.md` or open an issue on GitHub.
