# Hybrid n8n AI Tools Integration - Task Overview

## Goal
Enable ARK Agent Advanced to use n8n native AI tool sub-nodes (Calculator, Web Search, HTTP Request, etc.) alongside ARK-native tools configured in agent CRDs.

## Architecture

```
n8n Workflow
  ↓
[Calculator Tool] ──┐
[Web Search Tool] ──┼──→ ARK Agent Advanced
[HTTP Request] ─────┘     │
                          ├─ Converts n8n tools → ARK format
                          ├─ Merges with ARK agent's native tools
                          ├─ Sends query to ARK API
                          └─ Executes n8n tools locally when called

ARK API (Future)
  ├─ Accepts externalTools in Query spec
  ├─ Returns tool_call_required status
  └─ Accepts tool results via /tool-result endpoint
```

## Implementation Strategy

**Phase-based approach** with no dependencies on ARK API until Phase 3:

1. **Phase 1: Foundation** - Add sub-node connections, tool conversion (100% testable now)
2. **Phase 2: Mock ARK API** - Build test server implementing proposed API contract
3. **Phase 3: Execution Loop** - Implement tool callback logic
4. **Phase 4: E2E Testing** - Playwright tests integrated into `make e2e`
5. **Phase 5: Documentation** - Polish, examples, ARK API spec

## Task List

### Phase 1: Foundation (Weeks 1-2)
- [ ] **1.1** - Add `ai_tool` input connection to ArkAgentAdvanced
- [ ] **1.2** - Implement n8n tool → ARK tool spec converter
- [ ] **1.3** - Add "Tool Source" configuration UI
- [ ] **1.4** - Unit tests for tool conversion layer

### Phase 2: Mock ARK API (Week 3)
- [ ] **2.1** - Create mock ARK API server with Express
- [ ] **2.2** - Implement `/tool-result` callback endpoint
- [ ] **2.3** - Add stateful query execution tracking
- [ ] **2.4** - Integration tests for mock API

### Phase 3: Execution Loop (Week 4)
- [ ] **3.1** - Implement tool execution loop in node
- [ ] **3.2** - Error handling and iteration limits
- [ ] **3.3** - Tool execution history tracking
- [ ] **3.4** - Unit tests for execution scenarios

### Phase 4: E2E Testing (Week 5)
- [ ] **4.1** - Create E2E test workflow fixture
- [ ] **4.2** - Add Playwright test for hybrid execution
- [ ] **4.3** - Integrate into `make e2e`
- [ ] **4.4** - CI/CD pipeline updates

### Phase 5: Documentation (Week 6)
- [ ] **5.1** - Update CLAUDE.md with hybrid tools guide
- [ ] **5.2** - Create sample workflows
- [ ] **5.3** - ARK API specification document
- [ ] **5.4** - Performance testing and benchmarks

## Testing Strategy

### Unit Tests (Jest)
- Tool converter (Zod → JSON Schema)
- Tool source mode selection (ark/n8n/hybrid)
- Execution loop logic (mocked API responses)
- Error handling and edge cases

### E2E Tests (Playwright)
- Workflow: ARK Agent Advanced + Calculator sub-node
- Test query: "What is 25 * 42?"
- Verify: Calculator tool executed, correct result (1050)
- Integration: Part of `make e2e` suite

### Integration Tests
- Mock ARK API behavior validation
- Tool callback round-trip timing
- Concurrent query handling

## Success Metrics

- [ ] All unit tests pass with >80% coverage
- [ ] E2E test passes with hybrid tool execution
- [ ] No breaking changes to existing workflows
- [ ] Graceful degradation if ARK API doesn't support feature
- [ ] Documentation complete and accurate

## References

- [RFC Document](../n8n_ai_tools_integration.md) - Full technical design
- [ARK Agent Advanced Node](../../nodes/nodes/ArkAgentAdvanced/ArkAgentAdvanced.node.ts) - Current implementation
- [n8n AI Agent Docs](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/) - Sub-node architecture

---

**Status**: Planning Complete - Ready for Implementation
**Target Completion**: 6 weeks from start
**Current Phase**: Phase 1 - Foundation
