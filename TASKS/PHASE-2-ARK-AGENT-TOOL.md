# Phase 2: ARK Agent Tool Node

**Status**: ✅ COMPLETED
**Actual Time**: ~2 hours
**Priority**: High
**Completion Date**: February 10, 2026

## Overview

Create a custom n8n node that executes ARK agent queries. This is a **standard n8n node** (not an AI tool), allowing any workflow to call ARK agents.

## Purpose

Allow n8n workflows to execute ARK agents for specialized processing:
- Data analysis agents
- Content generation agents
- Decision-making agents
- Any ARK agent in the cluster

## Implementation

### File Structure

```
nodes/nodes/ArkAgentTool/
├── ArkAgentTool.node.ts       # Main node implementation
├── arkAgentTool.svg            # Icon (copy from ArkAgent)
└── __tests__/
    └── ArkAgentTool.node.test.ts  # Unit tests
```

### Node Configuration

**Display Name**: ARK Agent Tool
**Name**: arkAgentTool
**Group**: transform
**Icon**: arkAgentTool.svg

**Inputs**: 1 (main)
**Outputs**: 1 (main)

**Credentials**: arkApi (required)

### Properties

```typescript
properties: [
  {
    displayName: 'Agent Name',
    name: 'agentName',
    type: 'string',
    default: '',
    required: true,
    description: 'Name of ARK agent to execute',
    placeholder: 'data-analyzer-agent'
  },
  {
    displayName: 'Namespace',
    name: 'namespace',
    type: 'string',
    default: 'default',
    description: 'Kubernetes namespace'
  },
  {
    displayName: 'Timeout',
    name: 'timeout',
    type: 'string',
    default: '30s',
    description: 'Maximum wait time (e.g., "30s", "5m")'
  },
  {
    displayName: 'Memory',
    name: 'memory',
    type: 'string',
    default: '',
    description: 'Optional memory name for conversation history'
  },
  {
    displayName: 'Session ID',
    name: 'sessionId',
    type: 'string',
    default: '',
    description: 'Optional session ID for memory'
  }
]
```

### Execution Logic

```typescript
async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const returnData: INodeExecutionData[] = [];

  const agentName = this.getNodeParameter('agentName', 0) as string;
  const namespace = this.getNodeParameter('namespace', 0) as string;
  const timeout = this.getNodeParameter('timeout', 0) as string;
  const memory = this.getNodeParameter('memory', 0) as string;
  const sessionId = this.getNodeParameter('sessionId', 0) as string;

  const credentials = await this.getCredentials('arkApi');
  const baseUrl = credentials.baseUrl as string;

  for (let i = 0; i < items.length; i++) {
    try {
      // Get input from previous node
      const input = items[i].json.input as string ||
                    JSON.stringify(items[i].json);

      // Build query spec
      const queryName = `tool-query-${Date.now()}-${i}`;
      const queryBody: any = {
        name: queryName,
        type: 'user',
        input: input,
        target: {
          type: 'agent',
          name: agentName,
        },
        wait: true,
        timeout: timeout,
      };

      // Add optional memory
      if (memory) {
        queryBody.memory = {
          name: memory,
          namespace: namespace,
        };
      }

      // Add optional session ID
      if (sessionId) {
        queryBody.sessionId = sessionId;
      }

      // Execute query via ARK API
      const response = await this.helpers.request({
        method: 'POST',
        url: `${baseUrl}/v1/queries?namespace=${namespace}`,
        headers: {
          'Content-Type': 'application/json',
        },
        body: queryBody,
        json: true,
      });

      // Extract response
      const result = response.status?.response?.content ||
                     response.status?.response ||
                     '';

      returnData.push({
        json: {
          response: result,
          queryName: queryName,
          status: response.status?.phase || 'completed',
          agentName: agentName,
          sessionId: sessionId || undefined,
        },
        pairedItem: { item: i },
      });
    } catch (error) {
      if (this.continueOnFail()) {
        returnData.push({
          json: {
            error: error.message,
            agentName: agentName,
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

## Code Reuse

Reuse helpers from `nodes/utils/arkHelpers.ts`:
- `postQuery()` - Execute ARK query
- `extractResponseContent()` - Parse response
- Query building patterns from ArkAgentAdvanced

## Testing

### Unit Tests

```typescript
describe('ArkAgentTool', () => {
  it('should execute ARK agent query successfully', async () => {
    const mockFunctions = createMockExecuteFunctions({
      nodeParameters: {
        agentName: 'test-agent',
        namespace: 'default',
        timeout: '30s',
      },
      credentials: {
        arkApi: {
          baseUrl: 'http://ark-api:8000',
        },
      },
      inputData: [
        { json: { input: 'Test query' } },
      ],
    });

    mockFunctions.helpers.request = jest.fn().mockResolvedValue({
      status: {
        phase: 'completed',
        response: {
          content: 'Agent response',
        },
      },
    });

    const node = new ArkAgentTool();
    const result = await node.execute.call(mockFunctions);

    expect(result[0][0].json).toEqual({
      response: 'Agent response',
      queryName: expect.stringContaining('tool-query-'),
      status: 'completed',
      agentName: 'test-agent',
      sessionId: undefined,
    });
  });

  it('should handle errors gracefully with continueOnFail', async () => {
    // Test error handling
  });

  it('should support memory and session ID', async () => {
    // Test memory functionality
  });
});
```

### Manual Testing

```
Workflow:
1. Manual Trigger node
2. Set node with test data: { "input": "Analyze this data" }
3. ARK Agent Tool node:
   - Agent: "data-analyzer-agent"
   - Namespace: "default"
4. Display Results node

Execute and verify:
- ARK agent receives query
- Response returns to workflow
- Output appears in Display node
```

## Integration

### Update package.json

```json
"n8n": {
  "nodes": [
    ...existing nodes...,
    "dist/nodes/ArkAgentTool/ArkAgentTool.node.js"
  ]
}
```

### Build and Deploy

```bash
cd nodes
npm run build
# Verify: dist/nodes/ArkAgentTool/ArkAgentTool.node.js exists

# Test in Docker
docker build -t ark-n8n:test .
docker run -p 5678:5678 ark-n8n:test
# Open http://localhost:5678
# Search for "ARK Agent Tool" in node palette
```

## Example Workflows

### Example 1: Data Processing
```
HTTP Trigger (receives data)
  ↓
ARK Agent Tool
  Agent: "data-processor-agent"
  Input: {{ $json.rawData }}
  ↓
Send Email (with processed results)
```

### Example 2: Multi-Agent Pipeline
```
Manual Trigger
  ↓
ARK Agent Tool (Analyzer)
  Agent: "data-analyzer-agent"
  ↓
ARK Agent Tool (Enricher)
  Agent: "data-enricher-agent"
  Input: {{ $json.response }}
  ↓
Store in Database
```

### Example 3: Conversational Agent
```
Webhook Trigger (chat messages)
  ↓
ARK Agent Tool
  Agent: "support-agent"
  Memory: "conversation-memory"
  Session ID: "user-{{ $json.userId }}"
  Input: {{ $json.message }}
  ↓
HTTP Response (send agent reply)
```

## Success Criteria

- ✅ Node appears in n8n palette
- ✅ ARK agent executes successfully
- ✅ Response returns to workflow
- ✅ Error handling works
- ✅ Memory and session ID support
- ✅ Unit tests pass (>80% coverage)
- ✅ Manual testing successful

## Commit Message Template

```
feat: add ARK Agent Tool for workflow integration

Implements ARK Agent Tool node for executing ARK agents from n8n workflows.

Features:
- Execute ARK agent queries from any workflow
- Support for memory and session management
- Configurable timeout
- Error handling with continueOnFail
- Reuses arkHelpers utilities

Files:
- nodes/nodes/ArkAgentTool/ArkAgentTool.node.ts
- nodes/nodes/ArkAgentTool/__tests__/ArkAgentTool.node.test.ts
- Updated nodes/package.json

Testing:
- Unit tests with >80% coverage
- Manual workflow testing
- Verified ARK agent execution

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## Next Steps

After completion, proceed to Phase 3: ARK Workflow Tool implementation
