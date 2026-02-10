# Phase 3: Execution Loop Implementation

## Overview

Integrate the tool execution loop into ArkAgentAdvanced, enabling actual n8n tool execution when ARK API requests them.

## Architecture

```
ArkAgentAdvanced.execute()
  ↓
1. Get connected n8n tools
2. Convert to ARK format
3. Send Query with externalTools
  ↓
4. LOOP: while (status === 'tool_call_required')
  ↓
5. Find n8n tool by name
6. Execute tool.call() with args
7. Send result back to ARK API
  ↓
8. Return final response
```

## Tasks

### Task 3.1: Implement Tool Execution Loop

**Objective**: Core loop that executes n8n tools when ARK API requests them

**Implementation**:

```typescript
// In ArkAgentAdvanced.execute()
async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  // ... existing setup ...

  // Get and filter tools (from Phase 1)
  const finalTools = filterToolsBySource(arkTools, n8nTools, toolSource);

  // Send query with tools
  let queryResult = await this.createArkQuery(input, agentName, {
    tools: finalTools,
    memory: memoryRef,
    sessionId: sessionId,
  });

  // NEW: Tool execution loop
  const MAX_ITERATIONS = 10;
  let iteration = 0;
  const toolExecutionHistory = [];

  while (queryResult.status === 'tool_call_required' && iteration++ < MAX_ITERATIONS) {
    const { toolName, arguments: toolArgs } = queryResult.toolCall;

    // Find n8n tool (external tools only)
    const n8nTool = finalTools.find(
      t => t.name === toolName && t.executionMode === 'external'
    );

    if (!n8nTool || !n8nTool._n8nCallback) {
      // ARK-native tool, already executed server-side
      break;
    }

    try {
      // Execute n8n tool locally
      this.logger.info(`Executing n8n tool: ${toolName}`);
      const toolResult = await n8nTool._n8nCallback(JSON.stringify(toolArgs));

      toolExecutionHistory.push({
        toolName,
        success: true,
        duration: Date.now() - startTime,
      });

      // Send result back to ARK API
      queryResult = await this.continueArkQuery(queryResult.name, {
        toolName,
        toolResult,
        continueExecution: true,
      });

    } catch (error) {
      this.logger.error(`Tool execution failed: ${toolName}`, error);

      toolExecutionHistory.push({
        toolName,
        success: false,
        error: error.message,
      });

      // Send error as tool result
      queryResult = await this.continueArkQuery(queryResult.name, {
        toolName,
        toolResult: `Error: ${error.message}`,
        continueExecution: true,
      });
    }
  }

  // Check for infinite loop
  if (iteration >= MAX_ITERATIONS) {
    throw new Error(`Max tool execution iterations (${MAX_ITERATIONS}) reached`);
  }

  return [[{
    json: {
      ...queryResult,
      toolExecutionHistory,
    },
  }]];
}
```

**Files**:
- `nodes/nodes/ArkAgentAdvanced/ArkAgentAdvanced.node.ts`

**Testing**: Mock ARK API responses, verify loop executes correctly

**Effort**: 6 hours

---

### Task 3.2: Add ARK API Helper Methods

**Objective**: Create helper methods for query creation and continuation

**Implementation**:

```typescript
// File: nodes/utils/arkHelpers.ts

export async function createArkQueryWithTools(
  this: IExecuteFunctions,
  input: string,
  agentName: string,
  options: {
    tools: ArkToolSpec[];
    memory?: MemoryRef;
    sessionId?: string;
    namespace?: string;
  }
): Promise<QueryResult> {
  const credentials = await this.getCredentials('arkApi');
  const baseUrl = credentials.baseUrl as string;
  const namespace = options.namespace || 'default';

  // Separate external tools from internal tools
  const internalTools = options.tools.filter(t => t.executionMode !== 'external');
  const externalTools = options.tools.filter(t => t.executionMode === 'external');

  const querySpec = {
    spec: {
      input,
      targets: [{ type: 'agent', name: agentName }],
      tools: internalTools,  // ARK-native tools
      externalTools: externalTools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
      memory: options.memory,
      sessionId: options.sessionId,
      wait: true,
    },
  };

  const response = await this.helpers.request({
    method: 'POST',
    url: `${baseUrl}/v1/namespaces/${namespace}/queries`,
    json: querySpec,
  });

  return response;
}

export async function continueArkQuery(
  this: IExecuteFunctions,
  queryName: string,
  toolResult: {
    toolName: string;
    toolResult: string;
    continueExecution: boolean;
  },
  namespace: string = 'default'
): Promise<QueryResult> {
  const credentials = await this.getCredentials('arkApi');
  const baseUrl = credentials.baseUrl as string;

  const response = await this.helpers.request({
    method: 'POST',
    url: `${baseUrl}/v1/namespaces/${namespace}/queries/${queryName}/tool-result`,
    json: toolResult,
  });

  return response;
}
```

**Files**:
- `nodes/utils/arkHelpers.ts`
- `nodes/types/ark.ts` (new type definitions)

**Testing**: Unit tests with mocked HTTP requests

**Effort**: 4 hours

---

### Task 3.3: Error Handling and Edge Cases

**Objective**: Robust error handling for tool execution failures

**Scenarios**:
1. **Tool throws exception**: Catch, send error as tool result
2. **Tool timeout**: Implement timeout wrapper, abort after 30s
3. **ARK API unreachable**: Graceful failure with retry logic
4. **Invalid tool arguments**: Validate before execution
5. **Infinite loop**: Max iterations check (already in 3.1)

**Implementation**:

```typescript
// Timeout wrapper for tool execution
async function executeToolWithTimeout(
  callback: (input: string) => Promise<string>,
  input: string,
  timeoutMs: number = 30000
): Promise<string> {
  return Promise.race([
    callback(input),
    new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('Tool execution timeout')), timeoutMs)
    ),
  ]);
}

// Validate tool arguments against schema
function validateToolArguments(
  args: any,
  parameters: JSONSchema
): { valid: boolean; errors: string[] } {
  // Use ajv or similar for JSON Schema validation
  // Return validation result
}
```

**Files**:
- `nodes/utils/toolExecution.ts` (new)
- `nodes/nodes/ArkAgentAdvanced/ArkAgentAdvanced.node.ts`

**Testing**: Error scenarios, timeout tests, validation tests

**Effort**: 5 hours

---

### Task 3.4: Unit Tests for Execution Loop

**Objective**: Comprehensive testing of tool execution scenarios

**Test Cases**:

```typescript
describe('ArkAgentAdvanced - Tool Execution Loop', () => {
  it('should execute single n8n tool and return result', async () => {
    // Mock: Query returns tool_call_required → completed
    // Verify: Tool callback invoked, result sent back
  });

  it('should execute multiple sequential tool calls', async () => {
    // Mock: Query returns tool_call_required (tool1) → tool_call_required (tool2) → completed
    // Verify: Both tools executed in order
  });

  it('should handle tool execution error gracefully', async () => {
    // Mock: Tool throws exception
    // Verify: Error sent as tool result, query continues
  });

  it('should respect max iteration limit', async () => {
    // Mock: Query always returns tool_call_required
    // Verify: Throws after 10 iterations
  });

  it('should handle mixed ARK + n8n tools', async () => {
    // Mock: Query calls ARK tool (internal), then n8n tool (external)
    // Verify: Only n8n tool executed in loop
  });

  it('should handle tool timeout', async () => {
    // Mock: Tool takes >30 seconds
    // Verify: Timeout error sent as result
  });

  it('should track tool execution history', async () => {
    // Verify: Output includes toolExecutionHistory array
  });
});
```

**Files**:
- `nodes/nodes/ArkAgentAdvanced/__tests__/tool-execution-loop.test.ts` (new)

**Effort**: 6 hours

---

## Phase 3 Deliverables

- [ ] Tool execution loop implemented in ArkAgentAdvanced
- [ ] Helper methods for query creation and continuation
- [ ] Robust error handling (timeouts, exceptions, validation)
- [ ] Unit tests pass with >80% coverage
- [ ] Tool execution history tracked and returned
- [ ] Works with mock ARK API from Phase 2

## Success Metrics

- n8n tools execute correctly when called by ARK agent
- Tool execution loop handles 5+ sequential tool calls
- Error scenarios handled gracefully (no crashes)
- Max iteration limit prevents infinite loops
- Unit tests cover all execution paths

## Total Effort

21 hours (~3 weeks part-time)

## Next Phase

**Phase 4: E2E Testing** - Playwright tests with real n8n workflows and mock ARK API.
