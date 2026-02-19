# Phase 5: Documentation & Polish

## Overview

Finalize the hybrid tools feature with comprehensive documentation, sample workflows, ARK API specification, and performance testing.

## Tasks

### Task 5.1: Update CLAUDE.md Development Guide

**Objective**: Document hybrid tools architecture and usage for contributors

**Sections to Add**:

1. **Hybrid Tools Architecture**
   - How n8n tools connect to ARK agents
   - Tool conversion layer (Zod → JSON Schema)
   - Execution loop and proxy pattern
   - Diagrams (architecture, sequence)

2. **Development Workflow**
   - Adding new tool types
   - Testing hybrid tools locally
   - Mock ARK API usage

3. **Configuration Modes**
   - ARK-only, n8n-only, hybrid
   - When to use each mode
   - Best practices

**File**: `CLAUDE.md`

**Additions**:

```markdown
## Hybrid Tools Integration

### Overview

ARK Agent Advanced supports three tool execution modes:

1. **ARK Tools Only**: Tools configured in agent CRD (production)
2. **n8n Tools Only**: Connected sub-nodes (prototyping)
3. **Hybrid**: Merge both (recommended for flexibility)

### Architecture

```
n8n Workflow
  ↓
[Calculator] ──┐
[Web Search] ──┼──→ [ARK Agent Advanced]
               │     ↓
               │   Tool Converter (Zod → JSON Schema)
               │     ↓
               │   Filter by Tool Source Mode
               │     ↓
               └── Send to ARK API with externalTools
                     ↓
                   Execution Loop:
                   - ARK calls tool → tool_call_required
                   - n8n executes tool locally
                   - Result sent back to ARK
                   - Repeat until completed
```

### Example: Hybrid Workflow

**Workflow**:
```
[Webhook] → [ARK Agent Advanced]
               ↑
         [Calculator Tool] (n8n)
         [HTTP Request Tool] (n8n)

Agent CRD has:
  - database_query (ARK-native)
  - web_scraper (ARK-native)

Final tools (hybrid mode):
  ✓ calculator (n8n)
  ✓ http_request (n8n)
  ✓ database_query (ARK)
  ✓ web_scraper (ARK)
```

### Tool Conversion Details

n8n tools use LangChain/Zod schemas. Conversion to ARK format:

```typescript
// n8n Tool
{
  name: 'calculator',
  schema: z.object({
    expression: z.string().describe('Math expression')
  }),
  call: async (input) => eval(input)
}

// Converted to ARK Tool
{
  type: 'custom',
  name: 'calculator',
  description: 'Perform calculations',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Math expression'
      }
    },
    required: ['expression']
  },
  executionMode: 'external'
}
```

### Testing Hybrid Tools

**Unit Tests**: `cd nodes && npm test`

**E2E Tests**: `make e2e-hybrid`

**Local Development**:
```bash
# 1. Start mock ARK API
cd test-utils/mock-ark-api
npm run start

# 2. Start n8n
devspace dev

# 3. Create workflow with hybrid tools
# Connect Calculator → ARK Agent Advanced
# Execute and verify
```

### Best Practices

1. **Production**: Use ARK-only mode with pre-configured CRDs
2. **Prototyping**: Use n8n-only or hybrid for fast iteration
3. **Tool Naming**: Avoid name conflicts between ARK and n8n tools
4. **Error Handling**: n8n tools should return descriptive errors
5. **Performance**: ARK-native tools are faster (no round-trip)
```

**Effort**: 4 hours

---

### Task 5.2: Create Sample Workflows

**Objective**: Provide ready-to-use examples demonstrating hybrid tools

**Sample Workflows**:

1. **basic-hybrid-calculator.json**
   - Simple math assistant with Calculator tool
   - Demonstrates single tool execution

2. **research-assistant.json**
   - Uses Web Search (n8n) + Database Query (ARK)
   - Demonstrates hybrid mode

3. **multi-agent-coordinator.json**
   - ARK manager agent + n8n AI Agent Tool sub-agents
   - Demonstrates advanced multi-agent patterns

4. **error-handling-demo.json**
   - Includes intentionally failing tool
   - Shows graceful error handling

5. **tool-source-comparison.json**
   - Three branches: ARK-only, n8n-only, hybrid
   - Side-by-side comparison

**Files**:
- `samples/hybrid-tools/basic-hybrid-calculator.json`
- `samples/hybrid-tools/research-assistant.json`
- `samples/hybrid-tools/multi-agent-coordinator.json`
- `samples/hybrid-tools/error-handling-demo.json`
- `samples/hybrid-tools/tool-source-comparison.json`
- `samples/hybrid-tools/README.md` (usage guide)

**Effort**: 5 hours

---

### Task 5.3: ARK API Specification Document

**Objective**: Formal spec for ARK API team to implement

**Document**: `docs/ARK_API_HYBRID_TOOLS_SPEC.md`

**Contents**:

```markdown
# ARK API Specification: External Tools Support

## Version
v0.3.0 (proposed)

## Overview

Adds support for external tool execution where ARK API delegates tool calls to external systems (e.g., n8n workflows).

## API Changes

### 1. Query Spec Extension

**New Field**: `spec.externalTools`

```yaml
apiVersion: ark.mckinsey.com/v1alpha1
kind: Query
metadata:
  name: query-with-external-tools
spec:
  input: "What is 25 * 42?"
  targets:
    - type: agent
      name: math-assistant
  tools:  # Existing field (ARK-native tools)
    - type: builtin
      name: database_query
  externalTools:  # NEW: External tools
    - name: calculator
      description: Perform mathematical calculations
      parameters:
        type: object
        properties:
          expression:
            type: string
            description: Mathematical expression
        required:
          - expression
      executionMode: external  # Must be "external"
```

### 2. New Query Status

**Added Status**: `tool_call_required`

Query status progression:
- `pending` → `running` → `tool_call_required` → `running` → `completed`

When status is `tool_call_required`, response includes:

```json
{
  "status": "tool_call_required",
  "toolCall": {
    "name": "calculator",
    "arguments": {
      "expression": "25 * 42"
    }
  },
  "metadata": {
    "queryName": "query-with-external-tools",
    "waitingForTool": true
  }
}
```

### 3. New Endpoint: Tool Result Callback

**Endpoint**: `POST /v1/namespaces/{namespace}/queries/{name}/tool-result`

**Request**:
```json
{
  "toolName": "calculator",
  "toolResult": "1050",
  "continueExecution": true
}
```

**Response** (next status):
```json
{
  "status": "completed",  // or "tool_call_required" if more tools needed
  "response": "The answer to 25 * 42 is 1050."
}
```

### 4. Error Handling

**Tool Execution Error**:

Client sends error as tool result:
```json
{
  "toolName": "calculator",
  "toolResult": "Error: Division by zero",
  "continueExecution": true
}
```

ARK agent receives error and can:
- Retry with different arguments
- Ask user for clarification
- Abort and return error

### 5. Timeout Behavior

If client doesn't send tool result within timeout (default: 60s):
- Query status → `failed`
- Error message: "External tool execution timeout"

## Implementation Notes

1. **Concurrency**: Support only 1 external tool call at a time (sequential)
2. **State Management**: Store query state with tool execution history
3. **Security**: Validate tool results before passing to LLM
4. **Logging**: Log all external tool calls for audit

## Backward Compatibility

- `externalTools` field is optional (absent = current behavior)
- Existing queries continue to work unchanged
- Clients can detect support via `/v1/capabilities` endpoint

## Testing

Reference implementation: `test-utils/mock-ark-api/`

Integration tests: `e2e/tests/hybrid-tools.spec.ts`
```

**Files**:
- `docs/ARK_API_HYBRID_TOOLS_SPEC.md`
- `docs/diagrams/hybrid-tools-sequence.svg` (sequence diagram)

**Effort**: 4 hours

---

### Task 5.4: Performance Testing and Benchmarks

**Objective**: Measure and document performance characteristics

**Metrics to Measure**:

1. **Tool Execution Overhead**
   - ARK-native tool: baseline
   - n8n tool (external): +latency
   - Target: <500ms overhead

2. **Throughput**
   - Queries/second with hybrid tools
   - Compare: ARK-only vs hybrid

3. **Memory Usage**
   - n8n node memory during tool execution loop
   - Large tool results (1MB+) impact

4. **Concurrent Queries**
   - 10 simultaneous workflows with hybrid tools
   - Verify no blocking

**Benchmark Suite**:

```typescript
// File: benchmarks/hybrid-tools.bench.ts

import { performance } from 'perf_hooks';

describe('Hybrid Tools Performance', () => {
  it('measures tool execution overhead', async () => {
    // Execute same query with ARK-native vs n8n tool
    const arkOnlyTime = await measureQueryTime('ark-native-tool');
    const n8nToolTime = await measureQueryTime('n8n-calculator');

    const overhead = n8nToolTime - arkOnlyTime;
    console.log(`n8n tool overhead: ${overhead}ms`);

    expect(overhead).toBeLessThan(500);  // <500ms overhead target
  });

  it('handles 10 concurrent queries', async () => {
    const startTime = performance.now();

    const queries = Array(10).fill(null).map((_, i) =>
      executeHybridQuery(`Query ${i}`)
    );

    await Promise.all(queries);

    const duration = performance.now() - startTime;
    const avgDuration = duration / 10;

    console.log(`10 concurrent queries: ${duration}ms total, ${avgDuration}ms avg`);
    expect(avgDuration).toBeLessThan(5000);  // <5s per query avg
  });
});
```

**Performance Report**:

Document results in `docs/PERFORMANCE.md`:

```markdown
# Hybrid Tools Performance

## Benchmarks (as of 2026-02-10)

| Metric | ARK-Only | Hybrid (n8n) | Overhead |
|--------|----------|--------------|----------|
| Simple query (1 tool) | 500ms | 850ms | +350ms |
| Complex query (5 tools) | 2.5s | 4.2s | +1.7s |
| Concurrent (10 queries) | 5s total | 8s total | +3s |

## Recommendations

- **Production**: Use ARK-native tools for latency-critical paths
- **Prototyping**: n8n tools acceptable (<1s overhead per call)
- **Hybrid Mode**: Best for flexibility, acceptable overhead

## Optimization Tips

1. Cache tool results when possible
2. Use ARK-native tools for frequently called operations
3. Batch multiple n8n tool calls if feasible
4. Monitor tool execution times in production
```

**Files**:
- `benchmarks/hybrid-tools.bench.ts` (new)
- `docs/PERFORMANCE.md` (new)

**Effort**: 5 hours

---

### Task 5.5: Final Polish and Release Prep

**Objective**: Ensure feature is production-ready

**Checklist**:

- [ ] All unit tests pass (>80% coverage)
- [ ] All E2E tests pass
- [ ] Performance benchmarks meet targets
- [ ] Documentation complete and accurate
- [ ] Sample workflows tested
- [ ] CHANGELOG.md updated
- [ ] Version bumped to v0.3.0
- [ ] PR created for review

**CHANGELOG Entry**:

```markdown
## [0.3.0] - 2026-02-XX

### Added

- **Hybrid Tools Integration**: ARK Agent Advanced now supports n8n AI tool sub-nodes
  - Connect Calculator, Web Search, HTTP Request, and other n8n tools directly
  - Three modes: ARK-only, n8n-only, Hybrid (merge both)
  - Automatic tool conversion (Zod → JSON Schema)
  - Tool execution loop with error handling and iteration limits
  - Mock ARK API for testing and development

- **New Configuration**:
  - "Tool Source" dropdown (ark/n8n/hybrid)
  - Tool execution history in query results

- **Testing**:
  - E2E tests for hybrid tool execution
  - Performance benchmarks
  - Mock ARK API server for development

- **Documentation**:
  - CLAUDE.md updated with hybrid tools guide
  - Sample workflows demonstrating hybrid mode
  - ARK API specification document
  - Performance testing report

### Changed

- ArkAgentAdvanced node now accepts `ai_tool` input connections
- Query execution includes tool execution loop for external tools

### Performance

- n8n tool overhead: ~350ms per tool call
- Supports 10+ concurrent hybrid tool queries
```

**Files**:
- `CHANGELOG.md` (update)
- `package.json` (version bump to 0.3.0)
- `chart/Chart.yaml` (version bump)

**Effort**: 3 hours

---

## Phase 5 Deliverables

- [ ] CLAUDE.md updated with comprehensive hybrid tools guide
- [ ] 5 sample workflows created and tested
- [ ] ARK API specification document published
- [ ] Performance benchmarks completed and documented
- [ ] CHANGELOG updated
- [ ] Version v0.3.0 tagged and released

## Success Metrics

- Documentation enables users to use hybrid tools without support
- Sample workflows cover 80% of common use cases
- ARK API team has clear spec to implement
- Performance meets or exceeds targets

## Total Effort

21 hours (~3 weeks part-time)

---

## Project Complete!

Total estimated effort across all phases: **82 hours (~10 weeks part-time)**

**Final Deliverables**:
✅ Hybrid tool execution working end-to-end
✅ >80% test coverage across all phases
✅ E2E tests integrated into `make e2e`
✅ Comprehensive documentation
✅ Sample workflows
✅ ARK API specification
✅ Performance benchmarks
