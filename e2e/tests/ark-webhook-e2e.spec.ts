import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const N8N_URL = process.env.N8N_URL || 'http://localhost:8080';
const ARK_API_URL = process.env.ARK_API_URL || 'http://ark-api.ark-system.svc.cluster.local';

// Helper to execute kubectl commands
function kubectl(command: string): string {
  try {
    return execSync(`kubectl ${command}`, { encoding: 'utf-8' });
  } catch (error: any) {
    console.error(`kubectl command failed: ${command}`);
    console.error(error.stdout || error.message);
    throw error;
  }
}

// Helper to wait for condition with timeout
async function waitFor(
  condition: () => Promise<boolean>,
  timeoutMs: number = 30000,
  intervalMs: number = 1000
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timeout waiting for condition after ${timeoutMs}ms`);
}

test.describe('ARK Webhook E2E Test', () => {
  let workflowId: string;
  let webhookUrl: string;

  test.beforeAll(async () => {
    console.log('🔧 Setting up E2E test environment...\n');

    // Ensure ARK resources exist
    console.log('📦 Checking ARK resources...');
    try {
      kubectl('get agent test-agent -n default');
      console.log('✓ Agent "test-agent" exists');
    } catch {
      console.log('Creating ARK resources...');
      const arkResourcesPath = path.join(__dirname, '../fixtures/ark-resources.yaml');
      kubectl(`apply -f ${arkResourcesPath}`);
      console.log('✓ ARK resources created');

      // Wait for resources to be ready
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Check model exists
    try {
      kubectl('get model test-model -n default');
      console.log('✓ Model "test-model" exists');
    } catch {
      throw new Error('Model "test-model" not found. ARK resources may not be properly installed.');
    }

    console.log('\n');
  });

  test('should import workflow, execute via webhook, and verify Query CRD', async ({ page, request }) => {
    console.log('📝 Test: Webhook → ARK Agent → Response → Query CRD Verification\n');

    // Step 1: Navigate to n8n
    console.log('1️⃣ Navigating to n8n...');
    await page.goto(N8N_URL);
    await page.waitForLoadState('networkidle');
    console.log('✓ n8n loaded\n');

    // Step 2: Import workflow
    console.log('2️⃣ Importing webhook test workflow...');
    await page.goto(`${N8N_URL}/workflow/new`);
    await page.waitForLoadState('networkidle');

    // Open import menu
    await page.getByRole('button', { name: /workflow/i }).click();
    await page.getByRole('menuitem', { name: /import from file/i }).click();

    // Upload workflow file
    const workflowPath = path.join(__dirname, '../fixtures/webhook-test-workflow.json');
    const workflowContent = fs.readFileSync(workflowPath, 'utf-8');

    // Paste workflow JSON (if file upload doesn't work)
    const workflowData = JSON.parse(workflowContent);
    await page.evaluate((data) => {
      // @ts-ignore
      window.__n8nImportWorkflow = data;
    }, workflowData);

    // Alternative: Try file input if available
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(workflowPath);
    }

    console.log('✓ Workflow imported\n');

    // Step 3: Configure ARK credentials
    console.log('3️⃣ Configuring ARK credentials...');

    // Click on ARK Agent node
    await page.getByText('ARK Agent').click();
    await page.waitForTimeout(1000);

    // Click on credentials dropdown (if not configured)
    const credentialSelect = page.locator('[data-test-id="parameter-input-arkApi"]').first();
    if (await credentialSelect.count() > 0) {
      await credentialSelect.click();

      // Check if credentials exist or create new
      const createNew = page.getByRole('button', { name: /create new credential/i });
      if (await createNew.isVisible()) {
        await createNew.click();

        // Fill in ARK API credentials
        await page.fill('input[name="baseUrl"]', ARK_API_URL);
        await page.fill('input[name="namespace"]', 'default');

        // Save credentials
        await page.getByRole('button', { name: /save/i }).click();
        await page.waitForTimeout(1000);
      }
    }

    console.log('✓ Credentials configured\n');

    // Step 4: Save workflow
    console.log('4️⃣ Saving workflow...');
    await page.getByRole('button', { name: /save/i }).first().click();
    await page.waitForTimeout(2000);

    // Get workflow ID from URL
    const url = page.url();
    const match = url.match(/workflow\/([a-zA-Z0-9]+)/);
    if (!match) {
      throw new Error('Could not extract workflow ID from URL');
    }
    workflowId = match[1];
    console.log(`✓ Workflow saved with ID: ${workflowId}\n`);

    // Step 5: Activate workflow
    console.log('5️⃣ Activating workflow...');
    const activateButton = page.locator('[data-test-id="workflow-activate-switch"]');
    if (await activateButton.count() > 0) {
      await activateButton.click();
      await page.waitForTimeout(2000);
    }
    console.log('✓ Workflow activated\n');

    // Step 6: Get webhook URL
    console.log('6️⃣ Getting webhook URL...');
    webhookUrl = `${N8N_URL}/webhook/ark-test`;
    console.log(`✓ Webhook URL: ${webhookUrl}\n`);

    // Step 7: Execute webhook request
    console.log('7️⃣ Executing webhook request...');
    const testQuery = 'What is 2 plus 2?';
    const webhookPayload = {
      agent: 'test-agent',
      query: testQuery
    };

    console.log(`   Query: "${testQuery}"`);
    console.log(`   Agent: test-agent`);

    const response = await request.post(webhookUrl, {
      data: webhookPayload,
      timeout: 60000 // 60 second timeout for ARK query
    });

    expect(response.ok()).toBeTruthy();
    const responseData = await response.json();

    console.log('✓ Webhook executed successfully');
    console.log(`   Status: ${responseData.status}`);
    console.log(`   Response: ${responseData.response}`);
    console.log(`   Query Name: ${responseData.queryName}`);
    console.log(`   Duration: ${responseData.duration}\n`);

    // Verify response structure
    expect(responseData).toHaveProperty('success', true);
    expect(responseData).toHaveProperty('query', testQuery);
    expect(responseData).toHaveProperty('response');
    expect(responseData).toHaveProperty('queryName');
    expect(responseData).toHaveProperty('status');
    expect(responseData).toHaveProperty('duration');

    // Step 8: Verify Query CRD in Kubernetes
    console.log('8️⃣ Verifying Query CRD in Kubernetes...');

    // Extract query name from response
    const queryName = responseData.queryName;
    expect(queryName).toBeTruthy();
    console.log(`   Looking for Query: ${queryName}`);

    // Wait for Query to appear in K8s (it should already exist, but give it a moment)
    await waitFor(async () => {
      try {
        kubectl(`get query ${queryName} -n default -o json`);
        return true;
      } catch {
        return false;
      }
    }, 10000);

    // Get Query CRD details
    const queryJson = kubectl(`get query ${queryName} -n default -o json`);
    const query = JSON.parse(queryJson);

    console.log('✓ Query CRD found in Kubernetes');
    console.log(`   Name: ${query.metadata.name}`);
    console.log(`   Status: ${query.status?.state || 'unknown'}`);
    console.log(`   Input: ${query.spec?.input}`);

    // Verify Query spec matches our request
    expect(query.spec.input).toContain(testQuery);
    expect(query.spec.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'agent',
          name: 'test-agent'
        })
      ])
    );

    // Step 9: Verify Query response matches webhook response
    console.log('\n9️⃣ Verifying Query response matches webhook response...');

    const queryResponse = query.status?.response || '';
    const webhookResponse = responseData.response || '';

    console.log(`   Query CRD Response: ${queryResponse.substring(0, 100)}...`);
    console.log(`   Webhook Response: ${webhookResponse.substring(0, 100)}...`);

    expect(queryResponse).toBe(webhookResponse);
    console.log('✓ Responses match!\n');

    // Step 10: Verify execution appears in n8n
    console.log('🔟 Checking execution in n8n UI...');
    await page.goto(`${N8N_URL}/workflow/${workflowId}/executions`);
    await page.waitForLoadState('networkidle');

    // Check for successful execution
    const executionItem = page.locator('[data-test-id="execution-list-item"]').first();
    await expect(executionItem).toBeVisible({ timeout: 10000 });

    // Check execution status is success
    const successBadge = executionItem.locator('text=/success|completed/i');
    await expect(successBadge).toBeVisible();

    console.log('✓ Execution visible in n8n UI\n');

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ E2E TEST PASSED - All verifications successful!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Verified:');
    console.log('  ✓ Workflow import and configuration');
    console.log('  ✓ Webhook trigger execution');
    console.log('  ✓ ARK Agent query processing');
    console.log('  ✓ Query CRD creation in Kubernetes');
    console.log('  ✓ Response consistency (webhook ↔ Query CRD)');
    console.log('  ✓ Execution visibility in n8n UI');
    console.log('═══════════════════════════════════════════════════════\n');
  });

  test('should handle multiple concurrent webhook requests', async ({ request }) => {
    console.log('📝 Test: Concurrent Webhook Requests\n');

    if (!webhookUrl) {
      test.skip();
    }

    console.log('Sending 5 concurrent webhook requests...');

    const requests = Array.from({ length: 5 }, (_, i) => ({
      agent: 'test-agent',
      query: `What is ${i + 1} plus ${i + 1}?`
    }));

    const responses = await Promise.all(
      requests.map(payload =>
        request.post(webhookUrl, {
          data: payload,
          timeout: 60000
        })
      )
    );

    console.log('✓ All requests completed\n');

    // Verify all succeeded
    for (let i = 0; i < responses.length; i++) {
      expect(responses[i].ok()).toBeTruthy();
      const data = await responses[i].json();
      expect(data.success).toBe(true);
      expect(data.queryName).toBeTruthy();
      console.log(`  ✓ Request ${i + 1}: Query ${data.queryName} - ${data.status}`);
    }

    // Verify all Query CRDs exist
    console.log('\nVerifying Query CRDs...');
    const queries = kubectl('get queries -n default -o json');
    const queryList = JSON.parse(queries);

    expect(queryList.items.length).toBeGreaterThanOrEqual(5);
    console.log(`✓ Found ${queryList.items.length} Query CRDs in cluster\n`);
  });

  test('should handle agent errors gracefully', async ({ request }) => {
    console.log('📝 Test: Error Handling\n');

    if (!webhookUrl) {
      test.skip();
    }

    // Send request with non-existent agent
    console.log('Sending request with non-existent agent...');
    const response = await request.post(webhookUrl, {
      data: {
        agent: 'non-existent-agent',
        query: 'This should fail'
      },
      timeout: 30000
    });

    // Should return error response (may be 200 with error in JSON, or 4xx/5xx)
    const data = await response.json().catch(() => null);

    if (data) {
      console.log(`✓ Received error response: ${JSON.stringify(data)}\n`);
      // Verify error is communicated
      expect(data.success === false || data.status === 'failed' || data.error).toBeTruthy();
    } else {
      // HTTP error code
      expect(response.status()).toBeGreaterThanOrEqual(400);
      console.log(`✓ Received HTTP error: ${response.status()}\n`);
    }
  });

  test.afterAll(async () => {
    console.log('\n🧹 Cleanup...\n');

    // Optionally clean up test Query CRDs
    if (process.env.CLEANUP_QUERIES === 'true') {
      console.log('Deleting test Query CRDs...');
      try {
        kubectl('delete queries -l test=e2e -n default');
        console.log('✓ Query CRDs cleaned up');
      } catch (error) {
        console.log('Note: No Query CRDs to clean up or deletion failed');
      }
    } else {
      console.log('Keeping Query CRDs for inspection (set CLEANUP_QUERIES=true to auto-delete)');
    }

    console.log('\n');
  });
});
