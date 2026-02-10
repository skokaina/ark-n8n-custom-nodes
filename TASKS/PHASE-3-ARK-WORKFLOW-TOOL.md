# Phase 3: ARK Workflow Tool Node

**Status**: ⏸️ Waiting for Phase 2
**Estimated Time**: 2-3 hours
**Priority**: Medium

## Overview

Create a custom n8n node that executes n8n sub-workflows programmatically via API. This is a **standard n8n node** similar to the built-in "Execute Workflow" node, but callable from workflows.

## Purpose

Allow n8n workflows to execute other workflows as modular components:
- Data processing pipelines
- Report generation workflows
- Notification workflows
- Any n8n workflow via API

## Implementation

### File Structure

```
nodes/nodes/ArkWorkflowTool/
├── ArkWorkflowTool.node.ts       # Main node implementation
├── workflow.svg                   # Icon
└── __tests__/
    └── ArkWorkflowTool.node.test.ts  # Unit tests
```

### Node Configuration

**Display Name**: ARK Workflow Tool
**Name**: arkWorkflowTool
**Group**: transform
**Icon**: workflow.svg

**Inputs**: 1 (main)
**Outputs**: 1 (main)

**Credentials**: n8nApi (required - need to create if doesn't exist)

### Properties

```typescript
properties: [
  {
    displayName: 'Workflow',
    name: 'workflowId',
    type: 'options',
    typeOptions: {
      loadOptionsMethod: 'getWorkflows',
    },
    default: '',
    required: true,
    description: 'n8n workflow to execute',
  },
  {
    displayName: 'Timeout',
    name: 'timeout',
    type: 'number',
    default: 30000,
    description: 'Maximum wait time in milliseconds',
  },
]
```

### Load Options Method

```typescript
methods = {
  loadOptions: {
    async getWorkflows(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
      const credentials = await this.getCredentials('n8nApi');
      const baseUrl = credentials.baseUrl as string;
      const apiKey = credentials.apiKey as string;

      try {
        const workflows = await this.helpers.request({
          method: 'GET',
          url: `${baseUrl}/api/v1/workflows`,
          headers: {
            'X-N8N-API-KEY': apiKey,
            'Content-Type': 'application/json',
          },
          json: true,
        });

        return workflows.data.map((wf: any) => ({
          name: wf.name,
          value: wf.id,
        }));
      } catch (error) {
        console.error('Failed to load workflows:', error);
        return [];
      }
    },
  },
};
```

### Execution Logic

```typescript
async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const returnData: INodeExecutionData[] = [];

  const workflowId = this.getNodeParameter('workflowId', 0) as string;
  const timeout = this.getNodeParameter('timeout', 0) as number;

  const credentials = await this.getCredentials('n8nApi');
  const baseUrl = credentials.baseUrl as string;
  const apiKey = credentials.apiKey as string;

  for (let i = 0; i < items.length; i++) {
    try {
      // Get parameters from previous node
      const params = items[i].json;

      // Execute workflow via n8n API
      const response = await this.helpers.request({
        method: 'POST',
        url: `${baseUrl}/api/v1/workflows/${workflowId}/execute`,
        headers: {
          'X-N8N-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: {
          parameters: params,
        },
        json: true,
        timeout: timeout,
      });

      returnData.push({
        json: {
          result: response.data || response,
          workflowId: workflowId,
          executionId: response.executionId || undefined,
          success: true,
        },
        pairedItem: { item: i },
      });
    } catch (error) {
      if (this.continueOnFail()) {
        returnData.push({
          json: {
            error: error.message,
            workflowId: workflowId,
            success: false,
          },
          pairedItem: { item: i },
        });
        continue;
      }
      throw error;
    }
  }

  return [returnData];
}
```

## N8N API Credentials

Need to create credentials file if doesn't exist:

### File: `nodes/credentials/N8nApi.credentials.ts`

```typescript
import {
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class N8nApi implements ICredentialType {
  name = 'n8nApi';
  displayName = 'n8n API';
  documentationUrl = 'https://docs.n8n.io/api/';
  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'http://localhost:5678',
      placeholder: 'http://n8n.example.com',
      description: 'Base URL of n8n instance',
    },
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      description: 'n8n API key from Settings > API',
    },
  ];
}
```

Update `package.json`:
```json
"n8n": {
  "credentials": [
    ...existing credentials...,
    "dist/credentials/N8nApi.credentials.js"
  ]
}
```

## Testing

### Unit Tests

```typescript
describe('ArkWorkflowTool', () => {
  it('should load workflows from n8n API', async () => {
    const mockFunctions = createMockLoadOptionsFunctions({
      credentials: {
        n8nApi: {
          baseUrl: 'http://n8n:5678',
          apiKey: 'test-key',
        },
      },
    });

    mockFunctions.helpers.request = jest.fn().mockResolvedValue({
      data: [
        { id: 'wf-1', name: 'Data Pipeline' },
        { id: 'wf-2', name: 'Report Generator' },
      ],
    });

    const node = new ArkWorkflowTool();
    const options = await node.methods.loadOptions.getWorkflows.call(mockFunctions);

    expect(options).toEqual([
      { name: 'Data Pipeline', value: 'wf-1' },
      { name: 'Report Generator', value: 'wf-2' },
    ]);
  });

  it('should execute workflow successfully', async () => {
    const mockFunctions = createMockExecuteFunctions({
      nodeParameters: {
        workflowId: 'wf-123',
        timeout: 30000,
      },
      credentials: {
        n8nApi: {
          baseUrl: 'http://n8n:5678',
          apiKey: 'test-key',
        },
      },
      inputData: [
        { json: { data: 'test' } },
      ],
    });

    mockFunctions.helpers.request = jest.fn().mockResolvedValue({
      executionId: 'exec-456',
      data: { processed: true },
    });

    const node = new ArkWorkflowTool();
    const result = await node.execute.call(mockFunctions);

    expect(result[0][0].json).toEqual({
      result: { processed: true },
      workflowId: 'wf-123',
      executionId: 'exec-456',
      success: true,
    });
  });

  it('should handle errors gracefully', async () => {
    // Test error handling
  });
});
```

### Manual Testing

```
Setup:
1. Create a simple sub-workflow (e.g., "Data Processor")
   - Webhook Trigger
   - Code node: return { processed: input.data.toUpperCase() }
   - Respond to Webhook
2. Save and note the workflow ID

Main Workflow:
1. Manual Trigger
2. Set node: { "data": "hello world" }
3. ARK Workflow Tool:
   - Workflow: Select "Data Processor" from dropdown
4. Display Results

Execute and verify:
- Sub-workflow executes
- Result returns: { processed: "HELLO WORLD" }
- Output appears in Display node
```

## Example Workflows

### Example 1: Modular Processing
```
Manual Trigger
  ↓
Prepare Data
  ↓
ARK Workflow Tool
  Workflow: "data-processing-pipeline"
  ↓
Display Results
```

### Example 2: Parallel Execution
```
Split in Batches
  ↓
ARK Workflow Tool (in loop)
  Workflow: "process-single-item"
  Input: {{ $json }}
  ↓
Merge Results
```

### Example 3: Conditional Routing
```
IF node (check data type)
  ├─ Branch A: ARK Workflow Tool → "process-type-a"
  └─ Branch B: ARK Workflow Tool → "process-type-b"
```

## Success Criteria

- ✅ Node appears in n8n palette
- ✅ Workflow dropdown loads from n8n API
- ✅ Sub-workflow executes successfully
- ✅ Response returns to main workflow
- ✅ Error handling works
- ✅ N8N API credentials working
- ✅ Unit tests pass (>80% coverage)
- ✅ Manual testing successful

## Commit Message Template

```
feat: add ARK Workflow Tool for sub-workflow execution

Implements ARK Workflow Tool node for executing n8n workflows via API.

Features:
- Execute n8n workflows from any workflow
- Dropdown loads workflows from n8n API
- Configurable timeout
- Error handling with continueOnFail
- N8N API credentials support

Files:
- nodes/nodes/ArkWorkflowTool/ArkWorkflowTool.node.ts
- nodes/credentials/N8nApi.credentials.ts (if new)
- nodes/nodes/ArkWorkflowTool/__tests__/ArkWorkflowTool.node.test.ts
- Updated nodes/package.json

Testing:
- Unit tests with >80% coverage
- Manual workflow testing
- Verified sub-workflow execution

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## Next Steps

After completion, proceed to Phase 4: Documentation
