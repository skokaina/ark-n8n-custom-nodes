# Task 1.2: Implement n8n Tool → ARK Tool Spec Converter

## Objective
Create a conversion layer that transforms n8n LangChain tools into ARK tool specification format.

## Background

**n8n Tool Format** (LangChain-based):
```typescript
interface N8nTool {
  name: string;
  description: string;
  schema: ZodSchema;  // Zod schema
  call(input: string): Promise<string>;
}
```

**ARK Tool Format** (JSON):
```typescript
interface ArkToolSpec {
  type: 'custom';
  name: string;
  description: string;
  parameters: JSONSchema;  // JSON Schema format
  executionMode?: 'external';  // For proxy tools
}
```

**Key Challenge**: Convert Zod schemas to JSON Schema format.

## Implementation

### 1. Create Converter Utility

**File**: `nodes/utils/toolConverter.ts` (new)

```typescript
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { Tool } from '@langchain/core/tools';
import type { z } from 'zod';

export interface ArkToolSpec {
  type: 'custom';
  name: string;
  description: string;
  parameters: Record<string, any>;
  executionMode?: 'external';
  _n8nCallback?: (input: string) => Promise<string>;  // Internal reference
}

/**
 * Converts an n8n LangChain tool to ARK tool specification format
 */
export function convertN8nToolToArk(tool: Tool): ArkToolSpec {
  // Convert Zod schema to JSON Schema
  let parameters: Record<string, any>;

  if (tool.schema) {
    // Use zod-to-json-schema for conversion
    parameters = zodToJsonSchema(tool.schema, {
      name: `${tool.name}Parameters`,
      $refStrategy: 'none',  // Inline all definitions
    });

    // Remove $schema property added by zod-to-json-schema
    delete parameters.$schema;
  } else {
    // Fallback if no schema provided
    parameters = {
      type: 'object',
      properties: {},
    };
  }

  return {
    type: 'custom',
    name: tool.name,
    description: tool.description,
    parameters,
    executionMode: 'external',  // Signals proxy execution in ARK
    _n8nCallback: tool.call.bind(tool),  // Store for later execution
  };
}

/**
 * Converts multiple n8n tools to ARK format
 */
export function convertN8nToolsToArk(tools: Tool[]): ArkToolSpec[] {
  return tools.map(tool => convertN8nToolToArk(tool));
}

/**
 * Merges ARK-native tools with converted n8n tools
 * Deduplicates by name (ARK tools take precedence)
 */
export function mergeArkAndN8nTools(
  arkTools: ArkToolSpec[],
  n8nTools: ArkToolSpec[]
): ArkToolSpec[] {
  const toolMap = new Map<string, ArkToolSpec>();

  // Add n8n tools first
  n8nTools.forEach(tool => {
    toolMap.set(tool.name, tool);
  });

  // ARK tools override if same name
  arkTools.forEach(tool => {
    toolMap.set(tool.name, tool);
  });

  return Array.from(toolMap.values());
}

/**
 * Filters tools based on source mode
 */
export function filterToolsBySource(
  arkTools: ArkToolSpec[],
  n8nTools: ArkToolSpec[],
  mode: 'ark' | 'n8n' | 'hybrid'
): ArkToolSpec[] {
  switch (mode) {
    case 'ark':
      return arkTools;
    case 'n8n':
      return n8nTools;
    case 'hybrid':
      return mergeArkAndN8nTools(arkTools, n8nTools);
    default:
      return arkTools;  // Fallback to ARK-only
  }
}
```

### 2. Add Type Definitions

**File**: `nodes/types/tools.ts` (new)

```typescript
export interface ArkToolSpec {
  type: 'custom' | 'builtin';
  name: string;
  description: string;
  parameters?: Record<string, any>;
  executionMode?: 'internal' | 'external';
  _n8nCallback?: (input: string) => Promise<string>;
}

export type ToolSourceMode = 'ark' | 'n8n' | 'hybrid';
```

## Testing

### Unit Tests

**File**: `nodes/utils/__tests__/toolConverter.test.ts` (new)

```typescript
import { z } from 'zod';
import type { Tool } from '@langchain/core/tools';
import {
  convertN8nToolToArk,
  convertN8nToolsToArk,
  mergeArkAndN8nTools,
  filterToolsBySource,
} from '../toolConverter';

describe('Tool Converter', () => {
  describe('convertN8nToolToArk', () => {
    it('should convert simple calculator tool', () => {
      const calculatorTool: Tool = {
        name: 'calculator',
        description: 'Perform mathematical calculations',
        schema: z.object({
          expression: z.string().describe('Mathematical expression to evaluate'),
        }),
        call: jest.fn(),
      };

      const arkTool = convertN8nToolToArk(calculatorTool);

      expect(arkTool).toMatchObject({
        type: 'custom',
        name: 'calculator',
        description: 'Perform mathematical calculations',
        executionMode: 'external',
      });

      expect(arkTool.parameters).toEqual({
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Mathematical expression to evaluate',
          },
        },
        required: ['expression'],
      });

      expect(arkTool._n8nCallback).toBeDefined();
    });

    it('should convert HTTP request tool with complex schema', () => {
      const httpTool: Tool = {
        name: 'http_request',
        description: 'Make HTTP requests',
        schema: z.object({
          url: z.string().url().describe('URL to request'),
          method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).describe('HTTP method'),
          body: z.record(z.any()).optional().describe('Request body'),
        }),
        call: jest.fn(),
      };

      const arkTool = convertN8nToolToArk(httpTool);

      expect(arkTool.parameters.properties).toHaveProperty('url');
      expect(arkTool.parameters.properties).toHaveProperty('method');
      expect(arkTool.parameters.properties).toHaveProperty('body');
      expect(arkTool.parameters.required).toContain('url');
      expect(arkTool.parameters.required).toContain('method');
      expect(arkTool.parameters.required).not.toContain('body');  // Optional
    });

    it('should handle tool without schema', () => {
      const simpleTool: Tool = {
        name: 'simple_tool',
        description: 'A simple tool',
        schema: undefined,
        call: jest.fn(),
      };

      const arkTool = convertN8nToolToArk(simpleTool);

      expect(arkTool.parameters).toEqual({
        type: 'object',
        properties: {},
      });
    });

    it('should preserve tool callback function', async () => {
      const mockCallback = jest.fn().mockResolvedValue('42');
      const tool: Tool = {
        name: 'test_tool',
        description: 'Test',
        schema: z.object({}),
        call: mockCallback,
      };

      const arkTool = convertN8nToolToArk(tool);

      // Verify callback is stored
      expect(arkTool._n8nCallback).toBeDefined();

      // Verify callback works
      const result = await arkTool._n8nCallback!('test input');
      expect(result).toBe('42');
      expect(mockCallback).toHaveBeenCalledWith('test input');
    });
  });

  describe('convertN8nToolsToArk', () => {
    it('should convert multiple tools', () => {
      const tools: Tool[] = [
        {
          name: 'tool1',
          description: 'Tool 1',
          schema: z.object({ param1: z.string() }),
          call: jest.fn(),
        },
        {
          name: 'tool2',
          description: 'Tool 2',
          schema: z.object({ param2: z.number() }),
          call: jest.fn(),
        },
      ];

      const arkTools = convertN8nToolsToArk(tools);

      expect(arkTools).toHaveLength(2);
      expect(arkTools[0].name).toBe('tool1');
      expect(arkTools[1].name).toBe('tool2');
    });

    it('should handle empty array', () => {
      const arkTools = convertN8nToolsToArk([]);
      expect(arkTools).toEqual([]);
    });
  });

  describe('mergeArkAndN8nTools', () => {
    it('should merge ARK and n8n tools', () => {
      const arkTools = [
        { type: 'custom', name: 'ark_tool', description: 'ARK', parameters: {} },
      ];

      const n8nTools = [
        { type: 'custom', name: 'n8n_tool', description: 'n8n', parameters: {}, executionMode: 'external' },
      ];

      const merged = mergeArkAndN8nTools(arkTools, n8nTools);

      expect(merged).toHaveLength(2);
      expect(merged.map(t => t.name)).toContain('ark_tool');
      expect(merged.map(t => t.name)).toContain('n8n_tool');
    });

    it('should deduplicate by name (ARK takes precedence)', () => {
      const arkTools = [
        { type: 'custom', name: 'shared_tool', description: 'ARK version', parameters: {} },
      ];

      const n8nTools = [
        { type: 'custom', name: 'shared_tool', description: 'n8n version', parameters: {}, executionMode: 'external' },
      ];

      const merged = mergeArkAndN8nTools(arkTools, n8nTools);

      expect(merged).toHaveLength(1);
      expect(merged[0].description).toBe('ARK version');
      expect(merged[0].executionMode).toBeUndefined();  // ARK version doesn't have executionMode
    });
  });

  describe('filterToolsBySource', () => {
    const arkTools = [
      { type: 'custom', name: 'ark1', description: 'ARK 1', parameters: {} },
      { type: 'custom', name: 'ark2', description: 'ARK 2', parameters: {} },
    ];

    const n8nTools = [
      { type: 'custom', name: 'n8n1', description: 'n8n 1', parameters: {}, executionMode: 'external' },
      { type: 'custom', name: 'n8n2', description: 'n8n 2', parameters: {}, executionMode: 'external' },
    ];

    it('should return only ARK tools in ark mode', () => {
      const filtered = filterToolsBySource(arkTools, n8nTools, 'ark');
      expect(filtered).toHaveLength(2);
      expect(filtered).toEqual(arkTools);
    });

    it('should return only n8n tools in n8n mode', () => {
      const filtered = filterToolsBySource(arkTools, n8nTools, 'n8n');
      expect(filtered).toHaveLength(2);
      expect(filtered).toEqual(n8nTools);
    });

    it('should return merged tools in hybrid mode', () => {
      const filtered = filterToolsBySource(arkTools, n8nTools, 'hybrid');
      expect(filtered).toHaveLength(4);
      expect(filtered.map(t => t.name)).toContain('ark1');
      expect(filtered.map(t => t.name)).toContain('n8n2');
    });

    it('should fallback to ARK-only for invalid mode', () => {
      const filtered = filterToolsBySource(arkTools, n8nTools, 'invalid' as any);
      expect(filtered).toEqual(arkTools);
    });
  });
});
```

## Acceptance Criteria

- [ ] `convertN8nToolToArk()` correctly converts Zod schemas to JSON Schema
- [ ] Tool callback functions are preserved in `_n8nCallback` property
- [ ] `mergeArkAndN8nTools()` deduplicates by name (ARK precedence)
- [ ] `filterToolsBySource()` correctly handles all three modes
- [ ] All unit tests pass with >80% coverage
- [ ] No external dependencies added (zod-to-json-schema already in n8n)
- [ ] Type definitions are exported and documented

## Files Changed

- `nodes/utils/toolConverter.ts` (new)
- `nodes/types/tools.ts` (new)
- `nodes/utils/__tests__/toolConverter.test.ts` (new)

## Dependencies

- Task 1.1 (ai_tool input must exist to retrieve tools)

## Estimated Effort

- Implementation: 3 hours
- Testing: 3 hours
- **Total**: 6 hours

## Next Task

Task 1.3: Add "Tool Source" configuration UI
