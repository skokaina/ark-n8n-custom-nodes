# Task 1.4: Comprehensive Unit Tests for Tool Conversion Layer

## Objective
Ensure >80% test coverage for the entire tool conversion and filtering logic with comprehensive edge case testing.

## Background

This task consolidates and expands the testing from Tasks 1.1-1.3 to ensure robust, production-ready code before moving to Phase 2.

## Implementation

### 1. Integration Test Suite

**File**: `nodes/nodes/ArkAgentAdvanced/__tests__/tool-integration.test.ts` (new)

```typescript
import { ArkAgentAdvanced } from '../ArkAgentAdvanced.node';
import { createMockExecuteFunctions } from '../../../test-helpers/mocks';
import { z } from 'zod';

describe('ArkAgentAdvanced - Tool Integration (End-to-End)', () => {
  let node: ArkAgentAdvanced;

  beforeEach(() => {
    node = new ArkAgentAdvanced();
  });

  it('should integrate ARK and n8n tools in hybrid mode', async () => {
    // Setup: ARK agent with 2 native tools, 2 n8n tools connected
    const n8nTools = [
      {
        name: 'calculator',
        description: 'Perform calculations',
        schema: z.object({
          expression: z.string().describe('Math expression'),
        }),
        call: jest.fn().mockResolvedValue('42'),
      },
      {
        name: 'web_search',
        description: 'Search the web',
        schema: z.object({
          query: z.string().describe('Search query'),
        }),
        call: jest.fn().mockResolvedValue('Search results...'),
      },
    ];

    const mockFunctions = createMockExecuteFunctions({
      nodeParameters: {
        configurationMode: 'static',
        agent: 'hybrid-agent',
        toolSource: 'hybrid',
        input: 'What is 2+2 and search for cats',
      },
      inputConnections: {
        ai_tool: [n8nTools],
      },
    });

    // Mock ARK API: Agent has 2 native tools
    mockFunctions.helpers.request.mockImplementation((options: any) => {
      if (options.url.includes('/agents/hybrid-agent')) {
        return Promise.resolve({
          metadata: { name: 'hybrid-agent' },
          spec: {
            tools: [
              { name: 'database_query', description: 'Query DB', parameters: {} },
              { name: 'api_call', description: 'Call API', parameters: {} },
            ],
          },
        });
      }
      return Promise.resolve({});
    });

    await node.execute.call(mockFunctions);

    // Expected: 4 tools total (2 ARK + 2 n8n)
    // Verify this via internal state or logs (detailed verification in Phase 3)
  });

  it('should handle deduplication when ARK and n8n have same tool name', async () => {
    const n8nTools = [
      {
        name: 'web_search',  // Same name as ARK tool
        description: 'n8n web search',
        schema: z.object({ query: z.string() }),
        call: jest.fn(),
      },
    ];

    const mockFunctions = createMockExecuteFunctions({
      nodeParameters: {
        configurationMode: 'static',
        agent: 'test-agent',
        toolSource: 'hybrid',
      },
      inputConnections: {
        ai_tool: [n8nTools],
      },
    });

    mockFunctions.helpers.request.mockResolvedValue({
      spec: {
        tools: [
          { name: 'web_search', description: 'ARK web search', parameters: {} },  // Same name
        ],
      },
    });

    await node.execute.call(mockFunctions);

    // Expected: ARK tool takes precedence, only 1 web_search in final list
  });

  it('should gracefully handle ARK API failure when fetching agent tools', async () => {
    const n8nTools = [
      {
        name: 'calculator',
        description: 'Calc',
        schema: z.object({ expr: z.string() }),
        call: jest.fn(),
      },
    ];

    const mockFunctions = createMockExecuteFunctions({
      nodeParameters: {
        configurationMode: 'static',
        agent: 'failing-agent',
        toolSource: 'hybrid',
      },
      inputConnections: {
        ai_tool: [n8nTools],
      },
    });

    // Mock ARK API failure
    mockFunctions.helpers.request.mockRejectedValue(new Error('API unavailable'));

    // Should not throw, should fallback to n8n tools only
    await expect(node.execute.call(mockFunctions)).resolves.not.toThrow();
  });

  it('should work when no n8n tools are connected (ark mode)', async () => {
    const mockFunctions = createMockExecuteFunctions({
      nodeParameters: {
        configurationMode: 'static',
        agent: 'ark-only-agent',
        toolSource: 'ark',
      },
      inputConnections: {},  // No ai_tool connections
    });

    mockFunctions.helpers.request.mockResolvedValue({
      spec: {
        tools: [
          { name: 'ark_tool', description: 'ARK', parameters: {} },
        ],
      },
    });

    await expect(node.execute.call(mockFunctions)).resolves.not.toThrow();
  });

  it('should work when no ARK tools exist (n8n mode)', async () => {
    const n8nTools = [
      {
        name: 'calculator',
        description: 'Calc',
        schema: z.object({ expr: z.string() }),
        call: jest.fn(),
      },
    ];

    const mockFunctions = createMockExecuteFunctions({
      nodeParameters: {
        configurationMode: 'static',
        agent: 'minimal-agent',
        toolSource: 'n8n',
      },
      inputConnections: {
        ai_tool: [n8nTools],
      },
    });

    mockFunctions.helpers.request.mockResolvedValue({
      spec: { tools: [] },  // No ARK tools
    });

    await expect(node.execute.call(mockFunctions)).resolves.not.toThrow();
  });
});
```

### 2. Edge Cases and Error Handling

**File**: `nodes/utils/__tests__/toolConverter.edge-cases.test.ts` (new)

```typescript
import { z } from 'zod';
import { convertN8nToolToArk } from '../toolConverter';

describe('Tool Converter - Edge Cases', () => {
  it('should handle tools with nested object schemas', () => {
    const complexTool = {
      name: 'complex_api',
      description: 'Complex API call',
      schema: z.object({
        endpoint: z.string(),
        headers: z.record(z.string()),
        body: z.object({
          data: z.array(z.object({
            id: z.number(),
            value: z.string(),
          })),
        }),
      }),
      call: jest.fn(),
    };

    const arkTool = convertN8nToolToArk(complexTool);

    expect(arkTool.parameters.properties).toHaveProperty('endpoint');
    expect(arkTool.parameters.properties).toHaveProperty('headers');
    expect(arkTool.parameters.properties).toHaveProperty('body');
    expect(arkTool.parameters.properties.body.properties).toHaveProperty('data');
  });

  it('should handle tools with enum schemas', () => {
    const enumTool = {
      name: 'enum_tool',
      description: 'Tool with enums',
      schema: z.object({
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
        priority: z.enum(['low', 'medium', 'high']),
      }),
      call: jest.fn(),
    };

    const arkTool = convertN8nToolToArk(enumTool);

    expect(arkTool.parameters.properties.method.enum).toEqual(['GET', 'POST', 'PUT', 'DELETE']);
    expect(arkTool.parameters.properties.priority.enum).toEqual(['low', 'medium', 'high']);
  });

  it('should handle tools with array schemas', () => {
    const arrayTool = {
      name: 'array_tool',
      description: 'Tool with arrays',
      schema: z.object({
        tags: z.array(z.string()),
        scores: z.array(z.number()),
      }),
      call: jest.fn(),
    };

    const arkTool = convertN8nToolToArk(arrayTool);

    expect(arkTool.parameters.properties.tags.type).toBe('array');
    expect(arkTool.parameters.properties.tags.items.type).toBe('string');
    expect(arkTool.parameters.properties.scores.type).toBe('array');
    expect(arkTool.parameters.properties.scores.items.type).toBe('number');
  });

  it('should handle tools with optional fields', () => {
    const optionalTool = {
      name: 'optional_tool',
      description: 'Tool with optional fields',
      schema: z.object({
        required_field: z.string(),
        optional_field: z.string().optional(),
      }),
      call: jest.fn(),
    };

    const arkTool = convertN8nToolToArk(optionalTool);

    expect(arkTool.parameters.required).toContain('required_field');
    expect(arkTool.parameters.required).not.toContain('optional_field');
  });

  it('should handle tools with default values', () => {
    const defaultTool = {
      name: 'default_tool',
      description: 'Tool with defaults',
      schema: z.object({
        timeout: z.number().default(30),
        retries: z.number().default(3),
      }),
      call: jest.fn(),
    };

    const arkTool = convertN8nToolToArk(defaultTool);

    expect(arkTool.parameters.properties.timeout.default).toBe(30);
    expect(arkTool.parameters.properties.retries.default).toBe(3);
  });

  it('should handle tools with very long descriptions', () => {
    const longDesc = 'A'.repeat(1000);  // 1000 character description
    const tool = {
      name: 'long_desc_tool',
      description: longDesc,
      schema: z.object({ param: z.string() }),
      call: jest.fn(),
    };

    const arkTool = convertN8nToolToArk(tool);

    expect(arkTool.description).toBe(longDesc);
    expect(arkTool.description.length).toBe(1000);
  });

  it('should handle tools with special characters in names', () => {
    const tool = {
      name: 'tool_with-special.chars',
      description: 'Special chars',
      schema: z.object({ param: z.string() }),
      call: jest.fn(),
    };

    const arkTool = convertN8nToolToArk(tool);

    expect(arkTool.name).toBe('tool_with-special.chars');
  });

  it('should preserve tool context when binding call function', async () => {
    class CustomTool {
      constructor(private value: string) {}

      schema = z.object({ input: z.string() });
      name = 'custom_tool';
      description = 'Custom';

      async call(input: string): Promise<string> {
        return `${this.value}: ${input}`;
      }
    }

    const toolInstance = new CustomTool('PREFIX');
    const arkTool = convertN8nToolToArk(toolInstance);

    // Verify context is preserved
    const result = await arkTool._n8nCallback!('test');
    expect(result).toBe('PREFIX: test');
  });
});
```

### 3. Coverage Report

Run coverage and ensure >80%:

```bash
cd nodes
npm run test:coverage
```

**Expected Coverage**:
- `utils/toolConverter.ts`: >90%
- `nodes/ArkAgentAdvanced/ArkAgentAdvanced.node.ts`: >80%
- Overall: >80%

## Acceptance Criteria

- [ ] Integration tests cover end-to-end tool filtering scenarios
- [ ] Edge case tests cover complex schemas (nested, enums, arrays, optionals)
- [ ] Error handling tests verify graceful degradation
- [ ] Coverage report shows >80% for all modified files
- [ ] All tests pass with `npm test`
- [ ] No flaky tests (run 10 times, all pass)

## Files Changed

- `nodes/nodes/ArkAgentAdvanced/__tests__/tool-integration.test.ts` (new)
- `nodes/utils/__tests__/toolConverter.edge-cases.test.ts` (new)

## Dependencies

- Task 1.1, 1.2, 1.3 (all previous Phase 1 tasks)

## Estimated Effort

- Implementation: 4 hours
- Coverage verification: 1 hour
- **Total**: 5 hours

## Next Phase

**Phase 2: Mock ARK API** - Build test server to enable development without ARK API dependency.

---

## Phase 1 Completion Checklist

Before moving to Phase 2, verify:

- [ ] All Phase 1 tasks (1.1-1.4) completed
- [ ] All unit tests pass
- [ ] Coverage >80%
- [ ] No TypeScript errors (`npm run build` succeeds)
- [ ] Manual testing in n8n UI confirms tool connections work
- [ ] Code reviewed and merged to main branch
