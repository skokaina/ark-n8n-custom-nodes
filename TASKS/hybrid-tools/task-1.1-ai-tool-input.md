# Task 1.1: Add ai_tool Input Connection to ArkAgentAdvanced

## Objective
Enable ArkAgentAdvanced node to accept n8n AI tool sub-nodes via the `ai_tool` connection type.

## Background
n8n AI nodes use a hierarchical architecture where sub-nodes connect to root AI Agent nodes via specific connection types:
- `ai_languageModel` - Chat Model nodes
- `ai_tool` - Tool nodes (Calculator, Web Search, etc.)
- `ai_memory` - Memory nodes
- `ai_outputParser` - Output parsers

We need to add `ai_tool` support to ArkAgentAdvanced to receive connected tool sub-nodes.

## Implementation

### 1. Update Node Inputs

**File**: `nodes/nodes/ArkAgentAdvanced/ArkAgentAdvanced.node.ts`

**Changes**:
```typescript
// Current inputs
inputs: ['main'],

// New inputs (multi-input configuration)
inputs: [
  'main',
  {
    displayName: 'Tools',
    type: 'ai_tool',
    maxConnections: -1,  // Unlimited tool connections
    required: false,
  },
],
```

### 2. Access Connected Tools in execute()

Add method to retrieve connected tools:

```typescript
async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();

  // Get connected n8n AI tools
  const connectedTools = await this.getInputConnectionData('ai_tool', 0);

  // Log for debugging (will expand in next tasks)
  if (connectedTools && connectedTools.length > 0) {
    console.log(`Connected n8n tools: ${connectedTools.length}`);
    connectedTools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
  }

  // Existing execution logic continues...
  // (Will integrate tools in later tasks)
}
```

### 3. Update Node Display

Add visual indicator showing connected tools count:

```typescript
// In node description properties
displayOptions: {
  show: {
    '@version': [1],
  },
},
subtitle: '={{$parameter["configurationMode"] === "dynamic" ? "Dynamic Config" : $parameter["agent"]}} • {{$parameter["toolSource"] || "ARK Tools"}}',
```

## Testing

### Unit Tests

**File**: `nodes/nodes/ArkAgentAdvanced/__tests__/ai-tool-input.test.ts`

```typescript
import { ArkAgentAdvanced } from '../ArkAgentAdvanced.node';
import { createMockExecuteFunctions } from '../../../test-helpers/mocks';

describe('ArkAgentAdvanced - AI Tool Input', () => {
  let node: ArkAgentAdvanced;

  beforeEach(() => {
    node = new ArkAgentAdvanced();
  });

  it('should have ai_tool input connection defined', () => {
    const inputs = node.description.inputs;
    const aiToolInput = Array.isArray(inputs)
      ? inputs.find(i => typeof i === 'object' && i.type === 'ai_tool')
      : null;

    expect(aiToolInput).toBeDefined();
    expect(aiToolInput).toMatchObject({
      displayName: 'Tools',
      type: 'ai_tool',
      maxConnections: -1,
      required: false,
    });
  });

  it('should retrieve connected tools during execution', async () => {
    const mockCalculatorTool = {
      name: 'calculator',
      description: 'Perform mathematical calculations',
      schema: { type: 'object', properties: {} },
      call: jest.fn(),
    };

    const mockFunctions = createMockExecuteFunctions({
      nodeParameters: {
        configurationMode: 'static',
        agent: 'test-agent',
      },
      inputConnections: {
        ai_tool: [[mockCalculatorTool]],
      },
    });

    // Execute node
    await node.execute.call(mockFunctions);

    // Verify getInputConnectionData was called
    expect(mockFunctions.getInputConnectionData).toHaveBeenCalledWith('ai_tool', 0);
  });

  it('should handle no connected tools gracefully', async () => {
    const mockFunctions = createMockExecuteFunctions({
      nodeParameters: {
        configurationMode: 'static',
        agent: 'test-agent',
      },
      inputConnections: {},
    });

    // Should not throw
    await expect(node.execute.call(mockFunctions)).resolves.not.toThrow();
  });

  it('should handle multiple connected tools', async () => {
    const tools = [
      { name: 'calculator', description: 'Math tool', schema: {}, call: jest.fn() },
      { name: 'web_search', description: 'Search tool', schema: {}, call: jest.fn() },
      { name: 'http_request', description: 'HTTP tool', schema: {}, call: jest.fn() },
    ];

    const mockFunctions = createMockExecuteFunctions({
      nodeParameters: {
        configurationMode: 'static',
        agent: 'test-agent',
      },
      inputConnections: {
        ai_tool: [tools],
      },
    });

    await node.execute.call(mockFunctions);

    // Verify all tools were received
    const receivedTools = mockFunctions.getInputConnectionData('ai_tool', 0);
    expect(receivedTools).toHaveLength(3);
  });
});
```

### Manual Testing Steps

1. Build nodes: `cd nodes && npm run build`
2. Start DevSpace: `devspace dev`
3. Open n8n UI: http://localhost:5678
4. Create new workflow
5. Add "ARK Agent Advanced" node
6. Add "Calculator" tool node (from n8n AI tools)
7. Connect Calculator → ARK Agent Advanced (Tools input)
8. Verify connection appears visually
9. Check n8n logs for "Connected n8n tools: 1" message

## Acceptance Criteria

- [ ] `ai_tool` input connection type added to node definition
- [ ] Multiple tools can connect to the input (maxConnections: -1)
- [ ] `getInputConnectionData('ai_tool', 0)` successfully retrieves connected tools
- [ ] Node logs connected tool names and descriptions
- [ ] All unit tests pass with >80% coverage
- [ ] No breaking changes to existing workflows (backward compatible)
- [ ] Manual testing confirms visual connection works in n8n UI

## Files Changed

- `nodes/nodes/ArkAgentAdvanced/ArkAgentAdvanced.node.ts`
- `nodes/nodes/ArkAgentAdvanced/__tests__/ai-tool-input.test.ts` (new)
- `nodes/test-helpers/mocks.ts` (extend to support ai_tool connections)

## Dependencies

- None (standalone task)

## Estimated Effort

- Implementation: 2 hours
- Testing: 2 hours
- **Total**: 4 hours

## Next Task

Task 1.2: Implement n8n tool → ARK tool spec converter
