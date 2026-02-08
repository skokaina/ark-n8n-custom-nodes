#!/usr/bin/env node

/**
 * Get auto-login URL for n8n
 * Creates session and returns direct access URL
 */

const { chromium } = require('playwright');
const fs = require('fs');

const N8N_URL = process.env.N8N_URL || 'http://localhost:5678';
const CREDS_FILE = '/tmp/n8n-default-creds.json';

async function getLoginUrl() {
  if (!fs.existsSync(CREDS_FILE)) {
    console.error('❌ Credentials file not found. Run setup first.');
    process.exit(1);
  }

  const creds = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to n8n
    await page.goto(N8N_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // If on signin page, log in
    if (page.url().includes('/signin')) {
      console.log('🔐 Logging in...');

      await page.fill('input[name="email"]', creds.email);
      await page.fill('input[name="password"]', creds.password);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
    }

    // Get cookies
    const cookies = await context.cookies();
    const authCookie = cookies.find(c => c.name.includes('n8n'));

    if (authCookie) {
      console.log('\n✅ Auto-login URL with session:\n');
      console.log(`${N8N_URL}?session=${authCookie.value}\n`);

      // Save for reference
      fs.writeFileSync('/tmp/n8n-auto-login-url.txt', N8N_URL);
    } else {
      console.log('\n✅ Direct access available:\n');
      console.log(`${N8N_URL}\n`);
      console.log('Credentials:');
      console.log(`  Email: ${creds.email}`);
      console.log(`  Password: ${creds.password}\n`);
    }

    await browser.close();

  } catch (error) {
    console.error('Error:', error.message);
    await browser.close();
    process.exit(1);
  }
}

getLoginUrl();
