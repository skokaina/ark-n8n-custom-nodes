#!/usr/bin/env node

/**
 * Script to import demo workflow into n8n via API
 * This runs after n8n is deployed but before tests
 */

const fs = require('fs');
const path = require('path');

const N8N_URL = process.env.N8N_URL || 'http://localhost:5678';
const WORKFLOW_FILE = path.join(__dirname, '../fixtures/demo-workflow.json');

async function importWorkflow() {
  console.log('Importing demo workflow to n8n...');

  // Read workflow JSON
  const workflow = JSON.parse(fs.readFileSync(WORKFLOW_FILE, 'utf8'));

  try {
    // n8n API endpoint for importing workflows
    const response = await fetch(`${N8N_URL}/api/v1/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workflow),
    });

    if (!response.ok) {
      throw new Error(`Failed to import workflow: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`✓ Workflow imported successfully: ${result.name} (ID: ${result.id})`);
    return result.id;
  } catch (error) {
    console.error('Error importing workflow:', error.message);
    console.log('This is expected for initial setup. Tests will handle workflow creation.');
    return null;
  }
}

// Run if called directly
if (require.main === module) {
  importWorkflow()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { importWorkflow };
