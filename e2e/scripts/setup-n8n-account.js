#!/usr/bin/env node

/**
 * Setup n8n with default account automatically
 * Creates owner account and saves credentials
 */

const { chromium } = require('playwright');

const N8N_URL = process.env.N8N_URL || 'http://localhost:5678';
const CREDS_FILE = process.env.CREDS_FILE || '/tmp/n8n-default-creds.json';
const DEFAULT_CREDS = {
  email: process.env.N8N_EMAIL || 'admin@example.com',  // Must be valid email format
  firstName: 'Admin',
  lastName: 'User',
  password: process.env.N8N_PASSWORD || 'Admin123!@#'  // Must have uppercase, number, 8+ chars
};

async function setupN8n() {
  console.log('🚀 Setting up n8n with default account...\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate directly to setup page
    console.log(`Connecting to ${N8N_URL}/setup...`);
    await page.goto(`${N8N_URL}/setup`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}\n`);

    if (currentUrl.includes('/setup')) {
      console.log('📝 Creating owner account...');
      console.log(`   Email: ${DEFAULT_CREDS.email}`);
      console.log(`   Password: ${DEFAULT_CREDS.password}\n`);

      // Wait for form to be visible
      await page.waitForSelector('input[name="email"]', { timeout: 10000 });

      // Fill form fields one by one with waits
      await page.fill('input[name="email"]', DEFAULT_CREDS.email);
      await page.waitForTimeout(500);

      await page.fill('input[name="firstName"]', DEFAULT_CREDS.firstName);
      await page.waitForTimeout(500);

      await page.fill('input[name="lastName"]', DEFAULT_CREDS.lastName);
      await page.waitForTimeout(500);

      await page.fill('input[name="password"]', DEFAULT_CREDS.password);
      await page.waitForTimeout(500);

      // Click submit button
      await page.click('button:has-text("Next")');

      // Wait for navigation or error
      await page.waitForTimeout(5000);

      // Check if we're still on setup page
      const finalUrl = page.url();

      if (finalUrl.includes('/setup')) {
        // Take screenshot for debugging
        await page.screenshot({ path: '/tmp/n8n-setup-failed.png' });
        console.error('❌ Still on setup page after submitting');
        console.error('Screenshot saved to /tmp/n8n-setup-failed.png');
        process.exit(1);
      }

      // Success!
      console.log('✅ Account created successfully!\n');

      // Save credentials
      const fs = require('fs');
      fs.writeFileSync(CREDS_FILE, JSON.stringify(DEFAULT_CREDS, null, 2));
      console.log(`💾 Credentials saved to ${CREDS_FILE}\n`);

      // Display credentials
      console.log('═══════════════════════════════════');
      console.log('  Default n8n Credentials');
      console.log('═══════════════════════════════════');
      console.log(`  Email:    ${DEFAULT_CREDS.email}`);
      console.log(`  Password: ${DEFAULT_CREDS.password}`);
      console.log('═══════════════════════════════════\n');

      await browser.close();
      process.exit(0);

    } else {
      console.log('✅ n8n already configured');

      // Check if credentials file exists
      const fs = require('fs');
      if (fs.existsSync(CREDS_FILE)) {
        const creds = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
        console.log('\n═══════════════════════════════════');
        console.log('  n8n Credentials');
        console.log('═══════════════════════════════════');
        console.log(`  Email:    ${creds.email}`);
        console.log(`  Password: ${creds.password}`);
        console.log('═══════════════════════════════════\n');
      }

      await browser.close();
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: '/tmp/n8n-error.png' }).catch(() => {});
    await browser.close();
    process.exit(1);
  }
}

setupN8n();
