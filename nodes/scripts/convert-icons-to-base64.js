#!/usr/bin/env node

/**
 * Convert SVG icons to base64 data URLs for n8n nodes
 * This fixes the icon loading issue with globally installed community nodes
 */

const fs = require('fs');
const path = require('path');

const iconMappings = {
  'ArkAgent': '../icons/ark-agent.svg',
  'ArkAgentAdvanced': 'nodes/ArkAgentAdvanced/ark-agent-advanced.svg',
  'ArkModel': '../icons/ark-model.svg',
  'ArkModelSelector': 'nodes/ArkModelSelector/ark-model-selector.svg',
  'ArkMemory': 'nodes/ArkMemory/ark-memory.svg',
  'ArkTeam': '../icons/ark-team.svg',
  'ArkEvaluation': '../icons/ark-evaluation.svg',
  'ArkTool': 'nodes/ArkTool/ark-tool.svg',
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

console.log('Converting SVG icons to base64 data URLs...\n');

Object.entries(iconMappings).forEach(([nodeName, iconPath]) => {
  const fullIconPath = path.join(__dirname, '..', iconPath);
  const nodeFile = path.join(__dirname, '..', nodeFiles[nodeName]);

  // Read SVG file
  if (!fs.existsSync(fullIconPath)) {
    console.error(`❌ Icon not found: ${fullIconPath}`);
    return;
  }

  const svgContent = fs.readFileSync(fullIconPath, 'utf8');
  const base64 = Buffer.from(svgContent).toString('base64');
  const dataUrl = `data:image/svg+xml;base64,${base64}`;

  // Read node file
  let nodeContent = fs.readFileSync(nodeFile, 'utf8');

  // Replace file: icon or existing data URL with new data URL (with type assertion for TypeScript)
  const iconRegex = /icon:\s*["'](file:[^"']+|data:image\/svg\+xml;base64,[^"']+)["'](\s+as\s+any)?/g;
  nodeContent = nodeContent.replace(iconRegex, `icon: "${dataUrl}" as any`);

  // Write updated node file
  fs.writeFileSync(nodeFile, nodeContent, 'utf8');

  console.log(`✅ Updated ${nodeName}: ${iconPath} → data URL (${base64.length} chars)`);
});

console.log('\n✨ Icon conversion complete! Run `npm run build` to rebuild nodes.');
