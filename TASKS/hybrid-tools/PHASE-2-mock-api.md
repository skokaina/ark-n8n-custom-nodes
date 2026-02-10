# Phase 2: Mock ARK API Server

## Overview

Build a mock ARK API server that implements the proposed `externalTools` specification. This enables:
- Independent development without ARK API team coordination
- Comprehensive E2E testing
- Reference implementation for ARK API team
- Faster iteration cycles

## Tasks

### Task 2.1: Create Mock ARK API Server Foundation

**Objective**: Set up Express server with basic ARK API endpoints

**Implementation**:
- Create `test-utils/mock-ark-api/` directory structure
- Express server with TypeScript
- Implement existing endpoints: `/agents`, `/models`, `/queries`
- In-memory state management for queries

**Files**:
- `test-utils/mock-ark-api/server.ts`
- `test-utils/mock-ark-api/state.ts`
- `test-utils/mock-ark-api/types.ts`
- `test-utils/mock-ark-api/package.json`

**Testing**: Basic health check, agent list endpoint

**Effort**: 4 hours

---

### Task 2.2: Implement External Tools Support

**Objective**: Add `externalTools` field handling and tool execution logic

**Implementation**:
- Update Query spec to accept `externalTools` array
- Implement tool execution state machine:
  - `pending` → `running` → `tool_call_required` → `running` → `completed`
- Return `tool_call_required` status with tool name and args
- Store query state for continuation

**New Endpoints**:
```typescript
POST /v1/namespaces/{ns}/queries
// Body includes spec.externalTools

Response when tool needed:
{
  status: 'tool_call_required',
  toolCall: {
    name: 'calculator',
    arguments: { expression: '2 + 2' }
  }
}
```

**Files**:
- `test-utils/mock-ark-api/handlers/queries.ts`
- `test-utils/mock-ark-api/handlers/external-tools.ts`

**Testing**: Query with externalTools returns tool_call_required

**Effort**: 6 hours

---

### Task 2.3: Implement Tool Result Callback Endpoint

**Objective**: Add endpoint to receive tool execution results and continue query

**Implementation**:
```typescript
POST /v1/namespaces/{ns}/queries/{name}/tool-result
{
  toolName: 'calculator',
  toolResult: '4',
  continueExecution: true
}

Response:
{
  status: 'completed',  // or 'tool_call_required' if more tools needed
  response: 'The answer is 4'
}
```

**Logic**:
- Retrieve query state from memory
- Append tool result to execution history
- Simulate agent processing (simple mock LLM response)
- Return next status (completed or another tool_call)

**Files**:
- `test-utils/mock-ark-api/handlers/tool-result.ts`
- `test-utils/mock-ark-api/mock-llm.ts` (simple response generator)

**Testing**: Full tool execution loop (create query → tool call → result → completion)

**Effort**: 5 hours

---

### Task 2.4: Integration Tests for Mock API

**Objective**: Comprehensive testing of mock API behavior

**Test Scenarios**:
1. Query with ARK-native tools only (no externalTools)
2. Query with externalTools, single tool call
3. Query with multiple sequential tool calls
4. Query with mixed ARK + external tools
5. Error handling: invalid tool name, tool execution timeout
6. Concurrent queries

**Files**:
- `test-utils/mock-ark-api/__tests__/server.test.ts`
- `test-utils/mock-ark-api/__tests__/tool-execution.test.ts`

**Testing**:
- Unit tests for each handler
- Integration test: start server, make requests, verify state
- Performance test: 10 concurrent queries

**Effort**: 4 hours

---

### Task 2.5: Helper Scripts and Documentation

**Objective**: Easy mock API usage for development and E2E tests

**Scripts**:
```bash
# Start mock API
test-utils/mock-ark-api/start.sh

# Run mock API in background (for E2E tests)
test-utils/mock-ark-api/start-background.sh

# Stop mock API
test-utils/mock-ark-api/stop.sh
```

**Documentation**:
- `test-utils/mock-ark-api/README.md` - Usage guide
- API specification document (OpenAPI/Swagger)
- Example requests (curl commands)

**Files**:
- `test-utils/mock-ark-api/README.md`
- `test-utils/mock-ark-api/api-spec.yaml` (OpenAPI)
- `test-utils/mock-ark-api/start.sh`
- `test-utils/mock-ark-api/start-background.sh`

**Effort**: 3 hours

---

## Phase 2 Deliverables

- [ ] Working mock ARK API server on `localhost:8001`
- [ ] Supports `externalTools` in Query spec
- [ ] Tool callback endpoint implemented
- [ ] Integration tests pass (>80% coverage)
- [ ] Documentation and helper scripts
- [ ] Can run via `npm run mock-api` command

## Success Metrics

- Mock API responds to all ARK API endpoints used by nodes
- Tool execution loop works end-to-end
- Integration tests verify external tool flow
- Mock API serves as reference spec for ARK team

## Total Effort

22 hours (~3 weeks part-time)

## Next Phase

**Phase 3: Execution Loop** - Integrate mock API with ArkAgentAdvanced node for actual tool execution.
