#!/usr/bin/env node

/**
 * Replace custom SVG icons with Font Awesome icons for better n8n compatibility
 */

const fs = require('fs');
const path = require('path');

// Font Awesome icon mappings for ARK nodes
const iconMappings = {
  'ArkAgent': 'fa:robot',
  'ArkAgentAdvanced': 'fa:user-robot',
  'ArkModel': 'fa:brain',
  'ArkModelSelector': 'fa:sliders',
  'ArkMemory': 'fa:database',
  'ArkTeam': 'fa:users',
  'ArkEvaluation': 'fa:check-circle',
  'ArkTool': 'fa:wrench',
};

const nodeFiles = {
  'ArkAgent': 'nodes/ArkAgent/ArkAgent.node.ts',
  'ArkAgentAdvanced': 'nodes/ArkAgentAdvanced/ArkAgentAdvanced.node.ts',
  'ArkModel': 'nodes/ArkModel/ArkModel.node.ts',
  'ArkModelSelector': 'nodes/ArkModelSelector/ArkModelSelector.node.ts',
  'ArkMemory': 'nodes/ArkMemory/ArkMemory.node.ts',
  'ArkTeam': 'nodes/ArkTeam/ArkTeam.node.ts',
  'ArkEvaluation': 'nodes/ArkEvaluation/ArkEvaluation.node.ts',
  'ArkTool': 'nodes/ArkTool/ArkTool.node.ts',
};

console.log('Replacing custom icons with Font Awesome icons...\n');

Object.entries(iconMappings).forEach(([nodeName, faIcon]) => {
  const nodeFile = path.join(__dirname, '..', nodeFiles[nodeName]);

  if (!fs.existsSync(nodeFile)) {
    console.error(`❌ Node file not found: ${nodeFile}`);
    return;
  }

  // Read node file
  let nodeContent = fs.readFileSync(nodeFile, 'utf8');

  // Replace any existing icon (file:, data:, or fa:) with Font Awesome icon
  const iconRegex = /icon:\s*["'](file:[^"']+|data:image\/svg\+xml;base64,[^"']+|fa:[^"']+)["'](\s+as\s+any)?/g;
  const newContent = nodeContent.replace(iconRegex, `icon: "${faIcon}"`);

  if (newContent !== nodeContent) {
    // Write updated node file
    fs.writeFileSync(nodeFile, newContent, 'utf8');
    console.log(`✅ Updated ${nodeName}: ${faIcon}`);
  } else {
    console.log(`⚠️  No change for ${nodeName} (icon might already be set)`);
  }
});

console.log('\n✨ Icon update complete! Run `npm run build` to rebuild nodes.');
