# Phase 4: E2E Testing with Playwright

## Overview

Create comprehensive end-to-end tests that verify hybrid tool execution works in a real n8n instance with the mock ARK API.

## Architecture

```
Playwright Test
  ↓
1. Start mock ARK API (localhost:8001)
2. Start n8n with custom nodes (localhost:5678)
3. Import test workflow
4. Execute workflow
5. Verify tool execution and results
6. Cleanup
```

## Tasks

### Task 4.1: Create E2E Test Workflow Fixture

**Objective**: Design n8n workflow that demonstrates hybrid tool execution

**Workflow Design**:

```
[Manual Trigger]
  ↓
  Input: "What is 25 * 42 and what is the capital of France?"
  ↓
[ARK Agent Advanced]
  Configuration:
    - Agent: "test-agent"
    - Tool Source: "Hybrid"
    - Memory: "test-memory"
    - Session ID: "e2e-test-session"
  ↓
  Connected Tools (n8n):
    - Calculator Tool
    - Web Search Tool (mock)
  ↓
  Agent Tools (ARK):
    - geography_facts (builtin)
  ↓
[HTTP Response] (return result)
```

**Workflow JSON**:

```json
{
  "name": "E2E Hybrid Tools Test",
  "nodes": [
    {
      "parameters": {},
      "name": "Manual Trigger",
      "type": "n8n-nodes-base.manualTrigger",
      "position": [250, 300]
    },
    {
      "parameters": {
        "configurationMode": "static",
        "agent": "test-agent",
        "toolSource": "hybrid",
        "input": "What is 25 * 42 and what is the capital of France?",
        "memory": "test-memory",
        "sessionId": "e2e-test-session"
      },
      "name": "ARK Agent Advanced",
      "type": "CUSTOM.arkAgentAdvanced",
      "position": [450, 300],
      "credentials": {
        "arkApi": {
          "id": "1",
          "name": "Mock ARK API"
        }
      }
    },
    {
      "parameters": {},
      "name": "Calculator",
      "type": "@n8n/n8n-nodes-langchain.toolCalculator",
      "position": [450, 150]
    },
    {
      "parameters": {},
      "name": "Web Search",
      "type": "@n8n/n8n-nodes-langchain.toolWebSearch",
      "position": [450, 450]
    }
  ],
  "connections": {
    "Manual Trigger": {
      "main": [[{"node": "ARK Agent Advanced", "type": "main", "index": 0}]]
    },
    "Calculator": {
      "ai_tool": [[{"node": "ARK Agent Advanced", "type": "ai_tool", "index": 0}]]
    },
    "Web Search": {
      "ai_tool": [[{"node": "ARK Agent Advanced", "type": "ai_tool", "index": 0}]]
    }
  }
}
```

**Files**:
- `e2e/fixtures/workflows/hybrid-tools-test.json`
- `e2e/fixtures/workflows/hybrid-tools-multiple-calls.json` (complex scenario)

**Effort**: 3 hours

---

### Task 4.2: Playwright Test Implementation

**Objective**: Automated test that imports, executes, and verifies workflow

**Test Implementation**:

```typescript
// File: e2e/tests/hybrid-tools.spec.ts

import { test, expect } from '@playwright/test';
import { startMockArkApi, stopMockArkApi } from '../helpers/mock-api';
import { importWorkflow, executeWorkflow, getExecutionResult } from '../helpers/n8n';

test.describe('Hybrid Tools Integration', () => {
  let mockApiProcess;

  test.beforeAll(async () => {
    // Start mock ARK API
    mockApiProcess = await startMockArkApi();
    await waitForApiReady('http://localhost:8001');
  });

  test.afterAll(async () => {
    // Stop mock ARK API
    await stopMockArkApi(mockApiProcess);
  });

  test('should execute workflow with hybrid tools (ARK + n8n)', async ({ page }) => {
    // 1. Navigate to n8n
    await page.goto('http://localhost:5678');

    // 2. Import workflow
    const workflowId = await importWorkflow(
      page,
      'e2e/fixtures/workflows/hybrid-tools-test.json'
    );

    // 3. Configure ARK API credentials (point to mock API)
    await page.click('text=ARK Agent Advanced');
    await page.click('text=Credentials');
    await page.fill('[data-test-id="credential-base-url"]', 'http://localhost:8001');
    await page.fill('[data-test-id="credential-namespace"]', 'default');
    await page.click('text=Save');

    // 4. Execute workflow
    await page.click('[data-test-id="execute-workflow-button"]');

    // 5. Wait for execution to complete
    await page.waitForSelector('[data-test-id="execution-success"]', { timeout: 30000 });

    // 6. Verify results
    const result = await getExecutionResult(page);

    // Verify tool execution history
    expect(result.toolExecutionHistory).toHaveLength(2);
    expect(result.toolExecutionHistory[0].toolName).toBe('calculator');
    expect(result.toolExecutionHistory[0].success).toBe(true);
    expect(result.toolExecutionHistory[1].toolName).toBe('geography_facts');

    // Verify final response contains both answers
    expect(result.response).toContain('1050');  // 25 * 42
    expect(result.response).toContain('Paris');  // Capital of France
  });

  test('should handle tool execution error gracefully', async ({ page }) => {
    // Import workflow with failing tool
    const workflowId = await importWorkflow(
      page,
      'e2e/fixtures/workflows/hybrid-tools-error.json'
    );

    await page.click('[data-test-id="execute-workflow-button"]');

    // Should complete without crashing
    await page.waitForSelector('[data-test-id="execution-success"]', { timeout: 30000 });

    const result = await getExecutionResult(page);

    // Verify error was handled
    expect(result.toolExecutionHistory[0].success).toBe(false);
    expect(result.toolExecutionHistory[0].error).toBeDefined();
  });

  test('should respect tool source mode selection', async ({ page }) => {
    // Test ARK-only mode
    await importWorkflow(page, 'e2e/fixtures/workflows/hybrid-tools-test.json');
    await page.click('text=ARK Agent Advanced');
    await page.selectOption('[data-test-id="tool-source-dropdown"]', 'ark');
    await page.click('[data-test-id="execute-workflow-button"]');

    await page.waitForSelector('[data-test-id="execution-success"]');
    const arkOnlyResult = await getExecutionResult(page);

    // Verify only ARK tools were used (no calculator)
    const toolNames = arkOnlyResult.toolExecutionHistory.map(t => t.toolName);
    expect(toolNames).not.toContain('calculator');
  });
});
```

**Files**:
- `e2e/tests/hybrid-tools.spec.ts` (new)
- `e2e/helpers/mock-api.ts` (new - mock API lifecycle)
- `e2e/helpers/n8n.ts` (extend with hybrid tool helpers)

**Effort**: 6 hours

---

### Task 4.3: Integrate into `make e2e`

**Objective**: Add hybrid tools tests to existing E2E test suite

**Makefile Updates**:

```makefile
# File: Makefile

.PHONY: e2e-hybrid
e2e-hybrid: ## Run E2E tests for hybrid tools
	@echo "Starting mock ARK API..."
	@cd test-utils/mock-ark-api && npm run start:background
	@sleep 2
	@echo "Running hybrid tools E2E tests..."
	@cd e2e && npx playwright test tests/hybrid-tools.spec.ts
	@echo "Stopping mock ARK API..."
	@cd test-utils/mock-ark-api && npm run stop

.PHONY: e2e
e2e: e2e-setup e2e-auth e2e-hybrid e2e-cleanup ## Run all E2E tests
	@echo "All E2E tests completed"
```

**CI/CD Integration**:

```yaml
# File: .github/workflows/e2e.yml

name: E2E Tests

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  e2e-hybrid-tools:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd nodes && npm ci
          cd ../test-utils/mock-ark-api && npm ci
          cd ../../e2e && npm ci

      - name: Build nodes
        run: cd nodes && npm run build

      - name: Start mock ARK API
        run: cd test-utils/mock-ark-api && npm run start:background

      - name: Setup Kubernetes cluster
        uses: helm/kind-action@v1

      - name: Deploy n8n with custom nodes
        run: make e2e-setup

      - name: Run hybrid tools E2E tests
        run: make e2e-hybrid

      - name: Upload Playwright artifacts
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-hybrid-tools-report
          path: e2e/playwright-report/

      - name: Cleanup
        if: always()
        run: make e2e-cleanup
```

**Files**:
- `Makefile` (update)
- `.github/workflows/e2e.yml` (update)

**Effort**: 3 hours

---

### Task 4.4: E2E Test Documentation

**Objective**: Document E2E test setup and troubleshooting

**Documentation**:

```markdown
# E2E Testing: Hybrid Tools

## Running Tests Locally

### Prerequisites
- Kubernetes cluster (kind, minikube, or Docker Desktop)
- Node.js 18+
- kubectl configured

### Quick Start

```bash
# Run all E2E tests (including hybrid tools)
make e2e

# Run only hybrid tools tests
make e2e-hybrid
```

### Manual Testing

```bash
# 1. Start mock ARK API
cd test-utils/mock-ark-api
npm run start:background

# 2. Deploy n8n
make e2e-setup

# 3. Run Playwright tests
cd e2e
npx playwright test tests/hybrid-tools.spec.ts --headed

# 4. Cleanup
make e2e-cleanup
cd ../test-utils/mock-ark-api
npm run stop
```

## Test Scenarios

| Test | Description | Expected Outcome |
|------|-------------|------------------|
| Basic Hybrid | Execute workflow with Calculator + ARK tool | Both tools execute, correct result |
| n8n-Only Mode | Tool source set to "n8n" | Only Calculator executes |
| ARK-Only Mode | Tool source set to "ark" | Only ARK tools execute |
| Tool Error | n8n tool throws exception | Error handled, workflow completes |
| Multiple Calls | Agent calls 5 tools sequentially | All execute in order |

## Troubleshooting

### Mock API not starting
- Check port 8001 is available: `lsof -i :8001`
- Check logs: `tail -f test-utils/mock-ark-api/logs/server.log`

### Workflow execution timeout
- Increase Playwright timeout in `e2e/playwright.config.ts`
- Check n8n logs: `kubectl logs deployment/ark-n8n`

### Tool not found
- Verify node build: `cd nodes && npm run build`
- Check N8N_CUSTOM_EXTENSIONS env var in deployment
```

**Files**:
- `docs/E2E_TESTING_HYBRID_TOOLS.md` (new)
- `e2e/README.md` (update)

**Effort**: 2 hours

---

## Phase 4 Deliverables

- [ ] E2E test workflow fixtures created
- [ ] Playwright tests implemented and passing
- [ ] Integrated into `make e2e` command
- [ ] CI/CD pipeline updated
- [ ] Documentation complete
- [ ] Tests pass locally and in CI

## Success Metrics

- All E2E tests pass with hybrid tool execution
- Tests run in <5 minutes total
- CI pipeline includes hybrid tools tests
- Documentation enables new contributors to run tests

## Total Effort

14 hours (~2 weeks part-time)

## Next Phase

**Phase 5: Documentation & Polish** - User docs, sample workflows, ARK API spec, performance testing.
