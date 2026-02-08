#!/usr/bin/env node

/**
 * Troubleshoot n8n authentication setup
 * Tests different approaches to bypass/automate setup
 */

const { chromium } = require('playwright');

const N8N_URL = process.env.N8N_URL || 'http://localhost:5678';

async function checkAuthStatus() {
  console.log('🔍 Checking n8n auth status...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to n8n
    console.log(`Navigating to ${N8N_URL}...`);
    await page.goto(N8N_URL, { waitUntil: 'networkidle' });

    // Wait a bit for redirects
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}\n`);

    // Check what page we're on
    if (currentUrl.includes('/setup')) {
      console.log('❌ On setup page - need to bypass owner account creation\n');
      await troubleshootSetup(page);
    } else if (currentUrl.includes('/signin')) {
      console.log('❌ On signin page - authentication required\n');
    } else if (currentUrl.includes('/workflow') || page.url() === N8N_URL + '/') {
      console.log('✅ Direct access to n8n - no auth required!\n');
    } else {
      console.log(`❓ Unknown page: ${currentUrl}\n`);
    }

    // Keep browser open for inspection
    console.log('\n⏸️  Browser kept open for inspection. Press Ctrl+C to close.');
    await page.waitForTimeout(300000); // 5 minutes

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

async function troubleshootSetup(page) {
  console.log('Attempting different bypass methods...\n');

  // Method 1: Check for skip button
  const skipButton = await page.locator('button:has-text("Skip")').count();
  if (skipButton > 0) {
    console.log('✅ Found Skip button');
    return;
  }

  // Method 2: Try to navigate directly to workflows
  console.log('Trying to navigate to /workflows directly...');
  await page.goto(N8N_URL + '/workflows');
  await page.waitForTimeout(2000);

  if (!page.url().includes('/setup')) {
    console.log('✅ Successfully bypassed setup by direct navigation!');
    return;
  }

  // Method 3: Check environment variables via API
  console.log('\nChecking n8n configuration via API...');
  try {
    const response = await page.request.get(N8N_URL + '/api/v1/health');
    console.log('Health check:', response.status());
  } catch (e) {
    console.log('API not accessible');
  }

  // Method 4: Create default account programmatically
  console.log('\n📝 Attempting to create default account...');
  await createDefaultAccount(page);
}

async function createDefaultAccount(page) {
  try {
    // Navigate back to setup if needed
    if (!page.url().includes('/setup')) {
      await page.goto(N8N_URL + '/setup');
      await page.waitForLoadState('networkidle');
    }

    // Fill in default credentials
    const defaultCreds = {
      email: 'admin@ark-n8n.local',
      firstName: 'ARK',
      lastName: 'Admin',
      password: 'ark-n8n-password'
    };

    console.log('Filling setup form with default credentials...');
    console.log(`Email: ${defaultCreds.email}`);
    console.log(`Password: ${defaultCreds.password}\n`);

    // Fill the form
    await page.fill('input[name="email"]', defaultCreds.email);
    await page.fill('input[name="firstName"]', defaultCreds.firstName);
    await page.fill('input[name="lastName"]', defaultCreds.lastName);
    await page.fill('input[name="password"]', defaultCreds.password);

    // Submit
    await page.click('button:has-text("Next")');

    // Wait for redirect
    await page.waitForTimeout(3000);

    if (!page.url().includes('/setup')) {
      console.log('✅ Account created successfully!');
      console.log('\nDefault credentials:');
      console.log(`  Email: ${defaultCreds.email}`);
      console.log(`  Password: ${defaultCreds.password}`);

      // Save credentials to file
      const fs = require('fs');
      const credsFile = '/tmp/n8n-default-creds.json';
      fs.writeFileSync(credsFile, JSON.stringify(defaultCreds, null, 2));
      console.log(`\n💾 Credentials saved to: ${credsFile}`);

      return defaultCreds;
    }
  } catch (error) {
    console.error('❌ Failed to create account:', error.message);
  }
}

// Run
checkAuthStatus().catch(console.error);
