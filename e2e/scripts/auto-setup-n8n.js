#!/usr/bin/env node

/**
 * Auto-setup n8n with default account
 * Creates owner account if setup page is detected
 */

const { chromium } = require('playwright');

const N8N_URL = process.env.N8N_URL || 'http://localhost:5678';
const DEFAULT_CREDS = {
  email: 'admin@localhost',
  firstName: 'Admin',
  lastName: 'User',
  password: 'admin123!@#'
};

async function autoSetup() {
  console.log('🚀 Auto-setup n8n...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(N8N_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    if (currentUrl.includes('/setup')) {
      console.log('📝 Setup page detected, creating default account...\n');

      // Fill form
      await page.fill('input[name="email"]', DEFAULT_CREDS.email);
      await page.fill('input[name="firstName"]', DEFAULT_CREDS.firstName);
      await page.fill('input[name="lastName"]', DEFAULT_CREDS.lastName);
      await page.fill('input[name="password"]', DEFAULT_CREDS.password);

      // Try to uncheck newsletter (optional)
      try {
        const checkbox = await page.locator('input[type="checkbox"]').first();
        await checkbox.uncheck({ timeout: 2000 });
      } catch (e) {
        console.log('Skipping newsletter checkbox');
      }

      // Submit
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(5000);

      if (!page.url().includes('/setup')) {
        console.log('✅ Account created successfully!\n');
        console.log('Default credentials:');
        console.log(`  Email:    ${DEFAULT_CREDS.email}`);
        console.log(`  Password: ${DEFAULT_CREDS.password}\n`);

        // Save to file
        const fs = require('fs');
        fs.writeFileSync('/tmp/n8n-creds.json', JSON.stringify(DEFAULT_CREDS, null, 2));
        console.log('💾 Credentials saved to /tmp/n8n-creds.json');

        process.exit(0);
      } else {
        console.error('❌ Failed to complete setup');
        process.exit(1);
      }
    } else {
      console.log('✅ n8n already configured, no setup needed');
      process.exit(0);
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

autoSetup();
