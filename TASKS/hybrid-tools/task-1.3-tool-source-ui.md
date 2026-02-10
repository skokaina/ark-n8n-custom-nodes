# Task 1.3: Add "Tool Source" Configuration UI

## Objective
Add a dropdown configuration option to ArkAgentAdvanced allowing users to choose between ARK tools, n8n tools, or hybrid mode.

## Background

Users should be able to control which tools the agent uses:
- **ARK Tools Only**: Use tools configured in agent CRD (current behavior)
- **n8n Tools Only**: Use only connected tool sub-nodes
- **Hybrid** (Recommended): Merge both ARK and n8n tools

## Implementation

### 1. Add Configuration Property

**File**: `nodes/nodes/ArkAgentAdvanced/ArkAgentAdvanced.node.ts`

Add new property to node description:

```typescript
{
  displayName: 'Tool Source',
  name: 'toolSource',
  type: 'options',
  options: [
    {
      name: 'ARK Tools Only',
      value: 'ark',
      description: 'Use tools configured in ARK agent CRD',
    },
    {
      name: 'n8n Tools Only',
      value: 'n8n',
      description: 'Use tools connected as sub-nodes',
    },
    {
      name: 'Hybrid (ARK + n8n)',
      value: 'hybrid',
      description: 'Merge ARK and n8n tools (recommended)',
    },
  ],
  default: 'hybrid',
  displayOptions: {
    show: {
      configurationMode: ['static'],  // Only show in static mode for now
    },
  },
  description: 'Choose which tools the agent can use',
},
```

### 2. Update execute() to Use Tool Source

**File**: `nodes/nodes/ArkAgentAdvanced/ArkAgentAdvanced.node.ts`

```typescript
import { filterToolsBySource } from '../../utils/toolConverter';
import { convertN8nToolsToArk } from '../../utils/toolConverter';

async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const returnData: INodeExecutionData[] = [];

  for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
    try {
      // Get configuration
      const configurationMode = this.getNodeParameter('configurationMode', itemIndex) as string;
      const toolSource = this.getNodeParameter('toolSource', itemIndex, 'hybrid') as 'ark' | 'n8n' | 'hybrid';
      const agentName = this.getNodeParameter('agent', itemIndex) as string;

      // Get connected n8n tools
      const connectedN8nTools = await this.getInputConnectionData('ai_tool', 0) || [];
      const n8nTools = convertN8nToolsToArk(connectedN8nTools);

      // Get ARK agent's native tools (from agent CRD)
      const arkTools = await this.getArkAgentTools(agentName);  // Helper method to fetch

      // Filter based on tool source mode
      const finalTools = filterToolsBySource(arkTools, n8nTools, toolSource);

      // Log tool selection for debugging
      this.logger.info(`Tool source: ${toolSource}`);
      this.logger.info(`ARK tools: ${arkTools.length}, n8n tools: ${n8nTools.length}, Final: ${finalTools.length}`);

      // Store filtered tools for use in query execution (next phase)
      // For now, just log them
      finalTools.forEach(tool => {
        this.logger.debug(`  - ${tool.name}: ${tool.description}`);
      });

      // Existing query execution logic continues...
      // (Will integrate finalTools in Phase 3)

    } catch (error) {
      if (this.continueOnFail()) {
        returnData.push({ json: { error: error.message } });
        continue;
      }
      throw error;
    }
  }

  return [returnData];
}
```

### 3. Add Helper Method to Fetch ARK Agent Tools

**File**: `nodes/utils/arkHelpers.ts`

```typescript
import type { IHttpRequestOptions } from 'n8n-workflow';
import type { ArkToolSpec } from '../types/tools';

/**
 * Fetches tools configured in an ARK agent CRD
 */
export async function getArkAgentTools(
  this: IExecuteFunctions,
  agentName: string,
  namespace: string = 'default'
): Promise<ArkToolSpec[]> {
  const credentials = await this.getCredentials('arkApi');
  const baseUrl = credentials.baseUrl as string;

  const options: IHttpRequestOptions = {
    method: 'GET',
    url: `${baseUrl}/v1/namespaces/${namespace}/agents/${agentName}`,
    json: true,
  };

  try {
    const response = await this.helpers.request(options);
    const tools = response.spec?.tools || [];

    // Convert ARK API tool format to our internal ArkToolSpec format
    return tools.map((tool: any) => ({
      type: tool.type || 'custom',
      name: tool.name,
      description: tool.description || '',
      parameters: tool.parameters || {},
      executionMode: 'internal',  // ARK-native tools execute server-side
    }));
  } catch (error) {
    this.logger.warn(`Failed to fetch ARK agent tools: ${error.message}`);
    return [];  // Graceful fallback
  }
}
```

### 4. Update Node Subtitle

Show active tool source in node subtitle:

```typescript
subtitle: '={{$parameter["agent"]}} • Tools: {{$parameter["toolSource"] || "hybrid"}}',
```

## Testing

### Unit Tests

**File**: `nodes/nodes/ArkAgentAdvanced/__tests__/tool-source-ui.test.ts` (new)

```typescript
import { ArkAgentAdvanced } from '../ArkAgentAdvanced.node';
import { createMockExecuteFunctions } from '../../../test-helpers/mocks';

describe('ArkAgentAdvanced - Tool Source UI', () => {
  let node: ArkAgentAdvanced;

  beforeEach(() => {
    node = new ArkAgentAdvanced();
  });

  it('should have toolSource property with three options', () => {
    const toolSourceProp = node.description.properties.find(
      (p: any) => p.name === 'toolSource'
    );

    expect(toolSourceProp).toBeDefined();
    expect(toolSourceProp.type).toBe('options');
    expect(toolSourceProp.default).toBe('hybrid');
    expect(toolSourceProp.options).toHaveLength(3);

    const optionValues = toolSourceProp.options.map((o: any) => o.value);
    expect(optionValues).toContain('ark');
    expect(optionValues).toContain('n8n');
    expect(optionValues).toContain('hybrid');
  });

  it('should filter to ARK tools only in ark mode', async () => {
    const mockFunctions = createMockExecuteFunctions({
      nodeParameters: {
        configurationMode: 'static',
        agent: 'test-agent',
        toolSource: 'ark',
      },
      inputConnections: {
        ai_tool: [
          [{ name: 'n8n_calculator', description: 'Calc', schema: {}, call: jest.fn() }],
        ],
      },
    });

    // Mock ARK API response with agent tools
    mockFunctions.helpers.request.mockResolvedValue({
      spec: {
        tools: [
          { name: 'ark_tool', description: 'ARK tool', parameters: {} },
        ],
      },
    });

    await node.execute.call(mockFunctions);

    // Verify only ARK tools would be used (check logs or internal state)
    // This will be more thoroughly tested in Phase 3 when tools are actually sent to API
  });

  it('should filter to n8n tools only in n8n mode', async () => {
    const mockFunctions = createMockExecuteFunctions({
      nodeParameters: {
        configurationMode: 'static',
        agent: 'test-agent',
        toolSource: 'n8n',
      },
      inputConnections: {
        ai_tool: [
          [
            { name: 'n8n_calculator', description: 'Calc', schema: {}, call: jest.fn() },
            { name: 'n8n_search', description: 'Search', schema: {}, call: jest.fn() },
          ],
        ],
      },
    });

    mockFunctions.helpers.request.mockResolvedValue({
      spec: { tools: [] },  // No ARK tools
    });

    await node.execute.call(mockFunctions);

    // Verify only n8n tools would be used
  });

  it('should merge tools in hybrid mode', async () => {
    const mockFunctions = createMockExecuteFunctions({
      nodeParameters: {
        configurationMode: 'static',
        agent: 'test-agent',
        toolSource: 'hybrid',
      },
      inputConnections: {
        ai_tool: [
          [{ name: 'n8n_tool', description: 'n8n', schema: {}, call: jest.fn() }],
        ],
      },
    });

    mockFunctions.helpers.request.mockResolvedValue({
      spec: {
        tools: [{ name: 'ark_tool', description: 'ARK', parameters: {} }],
      },
    });

    await node.execute.call(mockFunctions);

    // Verify both ARK and n8n tools would be used
  });

  it('should default to hybrid mode if not specified', async () => {
    const mockFunctions = createMockExecuteFunctions({
      nodeParameters: {
        configurationMode: 'static',
        agent: 'test-agent',
        // toolSource not specified
      },
    });

    mockFunctions.helpers.request.mockResolvedValue({
      spec: { tools: [] },
    });

    await node.execute.call(mockFunctions);

    // Verify hybrid mode is used by default
    expect(mockFunctions.getNodeParameter).toHaveBeenCalledWith('toolSource', 0, 'hybrid');
  });
});
```

### Manual Testing Steps

1. Build nodes: `cd nodes && npm run build`
2. Start DevSpace: `devspace dev`
3. Create workflow with ARK Agent Advanced
4. Verify "Tool Source" dropdown appears
5. Test each mode:
   - **ARK Tools Only**: Agent uses only CRD-configured tools
   - **n8n Tools Only**: Connect Calculator, verify only n8n tools logged
   - **Hybrid**: Verify both ARK and n8n tools are logged

## Acceptance Criteria

- [ ] "Tool Source" dropdown added with three options (ark/n8n/hybrid)
- [ ] Default value is "hybrid"
- [ ] Property only shows in static configuration mode
- [ ] `filterToolsBySource()` correctly applied in execute()
- [ ] Helper method `getArkAgentTools()` fetches ARK agent tools via API
- [ ] Node subtitle displays active tool source
- [ ] All unit tests pass with >80% coverage
- [ ] Manual testing confirms UI works correctly

## Files Changed

- `nodes/nodes/ArkAgentAdvanced/ArkAgentAdvanced.node.ts`
- `nodes/utils/arkHelpers.ts`
- `nodes/nodes/ArkAgentAdvanced/__tests__/tool-source-ui.test.ts` (new)

## Dependencies

- Task 1.1 (ai_tool input)
- Task 1.2 (tool converter utility)

## Estimated Effort

- Implementation: 3 hours
- Testing: 2 hours
- **Total**: 5 hours

## Next Task

Task 1.4: Unit tests for tool conversion layer
