import { test, expect } from '@playwright/test';

test.describe('ARK Custom Nodes E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('n8n UI loads successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/n8n/);
    // Check for n8n logo or main interface element
    await expect(page.locator('[data-test-id="canvas"]')).toBeVisible({ timeout: 30000 });
  });

  test('ARK credentials can be configured', async ({ page }) => {
    // Navigate to credentials
    await page.click('button:has-text("Settings")');
    await page.click('text=Credentials');

    // Add new credential
    await page.click('button:has-text("Add Credential")');

    // Search for ARK API
    await page.fill('input[placeholder*="Search"]', 'ARK API');

    // Check ARK API credential appears
    await expect(page.locator('text=ARK API')).toBeVisible({ timeout: 10000 });
  });

  test('ARK Agent node is available in node palette', async ({ page }) => {
    // Navigate directly to new workflow
    await page.goto('/workflow/new');
    await page.waitForLoadState('networkidle');

    // Open node creator
    await page.click('button[data-test-id="node-creator-plus-button"]');

    // Search for ARK Agent
    await page.fill('input[placeholder*="Search"]', 'ARK');

    // Check all ARK nodes appear
    await expect(page.locator('text=ARK Agent')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=ARK Model')).toBeVisible();
    await expect(page.locator('text=ARK Team')).toBeVisible();
    await expect(page.locator('text=ARK Evaluation')).toBeVisible();
  });

  test('ARK Agent Advanced node is available', async ({ page }) => {
    await page.goto('/workflow/new');
    await page.waitForLoadState('networkidle');

    await page.click('button[data-test-id="node-creator-plus-button"]');
    await page.fill('input[placeholder*="Search"]', 'ARK Agent Advanced');

    await expect(page.locator('text=ARK Agent Advanced')).toBeVisible({ timeout: 10000 });
  });

  test('can add ARK Agent node to canvas', async ({ page }) => {
    await page.goto('/workflow/new');
    await page.waitForLoadState('networkidle');

    // Add trigger
    await page.click('button[data-test-id="node-creator-plus-button"]');
    await page.fill('input[placeholder*="Search"]', 'Manual');
    await page.click('text=Manual Trigger');

    // Add ARK Agent
    await page.click('button[data-test-id="node-creator-plus-button"]');
    await page.fill('input[placeholder*="Search"]', 'ARK Agent');
    await page.click('text=ARK Agent');

    // Verify node is on canvas
    await expect(page.locator('text=ARK Agent')).toBeVisible();
  });

  test('ARK nodes have correct parameter fields', async ({ page }) => {
    await page.goto('/workflow/new');
    await page.waitForLoadState('networkidle');

    // Add Manual Trigger
    await page.click('button[data-test-id="node-creator-plus-button"]');
    await page.fill('input[placeholder*="Search"]', 'Manual');
    await page.click('text=Manual Trigger');

    // Add ARK Agent node
    await page.click('button[data-test-id="node-creator-plus-button"]');
    await page.fill('input[placeholder*="Search"]', 'ARK Agent');
    await page.click('text=ARK Agent');

    // Click on ARK Agent node to open parameters
    await page.click('text=ARK Agent');

    // Verify parameter fields exist
    await expect(page.locator('label:has-text("Agent")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('label:has-text("Input")')).toBeVisible();
    await expect(page.locator('label:has-text("Wait for Completion")')).toBeVisible();
  });

  test('workflow execution completes without errors', async ({ page }) => {
    await page.goto('/workflow/new');
    await page.waitForLoadState('networkidle');

    // Add Manual Trigger
    await page.click('button[data-test-id="node-creator-plus-button"]');
    await page.fill('input[placeholder*="Search"]', 'Manual');
    await page.click('text=Manual Trigger');

    // Add ARK Agent
    await page.click('button[data-test-id="node-creator-plus-button"]');
    await page.fill('input[placeholder*="Search"]', 'ARK Agent');
    await page.click('text=ARK Agent');

    // Connect nodes (if not auto-connected)
    // Configure ARK Agent parameters
    await page.click('text=ARK Agent');

    // Save workflow
    await page.click('button:has-text("Save")');
    await page.fill('input[placeholder*="workflow name"]', 'E2E Test Workflow');
    await page.click('button:has-text("Save")');

    // Execute workflow
    await page.click('button[data-test-id="execute-workflow-button"]');

    // Wait for execution to complete (adjust selector based on n8n version)
    await expect(page.locator('[data-test-id="execution-status"]')).toContainText(/success|completed/i, { timeout: 30000 });
  });
});

test.describe('ARK Agent Advanced Tests', () => {
  test('ARK Agent Advanced has memory and session fields', async ({ page }) => {
    await page.goto('/workflow/new');
    await page.waitForLoadState('networkidle');

    // Add ARK Agent Advanced
    await page.click('button[data-test-id="node-creator-plus-button"]');
    await page.fill('input[placeholder*="Search"]', 'ARK Agent Advanced');
    await page.click('text=ARK Agent Advanced');

    // Click to open parameters
    await page.click('text=ARK Agent Advanced');

    // Verify advanced fields
    await expect(page.locator('label:has-text("Memory")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('label:has-text("Session ID")')).toBeVisible();
    await expect(page.locator('label:has-text("Configuration Mode")')).toBeVisible();
  });
});
