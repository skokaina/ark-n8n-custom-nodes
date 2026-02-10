# Hybrid n8n AI Tools Integration - Implementation Guide

## 🎯 Project Overview

Enable ARK Agent Advanced to use n8n's native AI tool sub-nodes alongside ARK-native tools, creating a powerful hybrid approach.

**Status**: ✅ Planning Complete - Ready for Implementation

**Timeline**: 10 weeks (part-time) | 82 total hours

**Current Phase**: Phase 1 - Foundation

---

## 📋 Quick Navigation

| Phase | Focus | Status | Effort |
|-------|-------|--------|--------|
| [Phase 1](./task-1.1-ai-tool-input.md) | Foundation (sub-nodes, converter, UI) | 🔜 Not Started | 20h |
| [Phase 2](./PHASE-2-mock-api.md) | Mock ARK API Server | ⏸️ Waiting | 22h |
| [Phase 3](./PHASE-3-execution-loop.md) | Execution Loop | ⏸️ Waiting | 21h |
| [Phase 4](./PHASE-4-e2e-testing.md) | E2E Testing | ⏸️ Waiting | 14h |
| [Phase 5](./PHASE-5-documentation.md) | Documentation & Polish | ⏸️ Waiting | 21h |

---

## 🚀 Getting Started

### Step 1: Review Design

Read the following in order:

1. **[RFC Document](../n8n_ai_tools_integration.md)** - Full technical design (10 min read)
2. **[Design Review](#design-review-summary)** - Key architectural decisions (5 min read)
3. **[OVERVIEW.md](./OVERVIEW.md)** - Implementation strategy (5 min read)

### Step 2: Start Phase 1

Phase 1 has **no external dependencies** - you can start immediately!

**Tasks** (in order):
1. [Task 1.1](./task-1.1-ai-tool-input.md) - Add `ai_tool` input connection (4h)
2. [Task 1.2](./task-1.2-tool-converter.md) - Implement tool converter (6h)
3. [Task 1.3](./task-1.3-tool-source-ui.md) - Add configuration UI (5h)
4. [Task 1.4](./task-1.4-comprehensive-tests.md) - Comprehensive tests (5h)

**Start Here**: Open [task-1.1-ai-tool-input.md](./task-1.1-ai-tool-input.md)

---

## 🏗️ Design Review Summary

### Key Decisions

#### 1. **Build n8n-side First**
- Implement node changes before ARK API changes
- Use feature detection + graceful degradation
- Mock ARK API for testing

#### 2. **Tool Conversion Layer**
- Zod schemas → JSON Schema via `zod-to-json-schema`
- Store n8n callback in `_n8nCallback` property
- ARK tools take precedence in hybrid mode

#### 3. **Execution Loop**
- Max 10 iterations to prevent infinite loops
- 30s timeout per tool execution
- Error handling: send errors as tool results
- Track tool execution history

#### 4. **Mock API Strategy**
- Express server implementing proposed ARK API spec
- Enables E2E testing without real ARK cluster
- Reference implementation for ARK team

#### 5. **Backward Compatibility**
- `externalTools` field is optional (additive)
- Capability detection via `/v1/capabilities`
- Existing workflows continue to work

---

## 📊 Progress Tracking

### Phase 1: Foundation (Week 1-2)

- [ ] **Task 1.1**: Add ai_tool input connection
  - Estimate: 4 hours
  - Files: `ArkAgentAdvanced.node.ts`, tests
  - Acceptance: Sub-nodes connect, tools retrieved

- [ ] **Task 1.2**: Implement tool converter
  - Estimate: 6 hours
  - Files: `toolConverter.ts`, tests
  - Acceptance: Zod → JSON Schema works, >80% coverage

- [ ] **Task 1.3**: Add Tool Source UI
  - Estimate: 5 hours
  - Files: `ArkAgentAdvanced.node.ts`, `arkHelpers.ts`, tests
  - Acceptance: Dropdown works, filtering correct

- [ ] **Task 1.4**: Comprehensive tests
  - Estimate: 5 hours
  - Files: Integration tests, edge case tests
  - Acceptance: >80% coverage, all tests pass

**Phase 1 Total**: 20 hours

---

## 🧪 Testing Strategy

### Unit Tests (Jest)
- **Coverage Target**: >80%
- **Location**: `nodes/nodes/*/tests__/*.test.ts`
- **Run**: `cd nodes && npm test`

### E2E Tests (Playwright)
- **Location**: `e2e/tests/hybrid-tools.spec.ts`
- **Run**: `make e2e-hybrid`
- **CI**: Integrated into `.github/workflows/e2e.yml`

### Performance Tests
- **Location**: `benchmarks/hybrid-tools.bench.ts`
- **Target**: <500ms overhead per n8n tool call
- **Run**: `npm run benchmark`

---

## 📚 Key Files

### Source Code
- `nodes/nodes/ArkAgentAdvanced/ArkAgentAdvanced.node.ts` - Main node
- `nodes/utils/toolConverter.ts` - Tool conversion logic
- `nodes/utils/arkHelpers.ts` - ARK API helpers
- `nodes/types/tools.ts` - Type definitions

### Tests
- `nodes/nodes/ArkAgentAdvanced/__tests__/` - Unit tests
- `e2e/tests/hybrid-tools.spec.ts` - E2E tests
- `test-utils/mock-ark-api/` - Mock API server

### Documentation
- `CLAUDE.md` - Development guide (to be updated)
- `docs/ARK_API_HYBRID_TOOLS_SPEC.md` - ARK API spec (to be created)
- `samples/hybrid-tools/` - Example workflows (to be created)

---

## 🎓 Learning Resources

### n8n AI Tools
- [n8n AI Agent Docs](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/)
- [Multi-Agent Systems Blog](https://blog.n8n.io/multi-agent-systems/)
- [AI Agent Tool Docs](https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.toolaiagent/)

### ARK Resources
- Current ARK node implementations in `nodes/nodes/`
- ARK API endpoint usage in `nodes/utils/arkHelpers.ts`

---

## 🤝 Contributing

### Workflow

1. **Pick a task** from current phase
2. **Read task file** thoroughly
3. **Implement** with TDD (tests first!)
4. **Test locally**: `npm test` and manual testing
5. **Commit** with proper message
6. **Move to next task**

### Commit Message Format

```
feat(hybrid-tools): add ai_tool input connection to ArkAgentAdvanced

- Add ai_tool input type to node inputs
- Implement getInputConnectionData for retrieving tools
- Add unit tests for connection handling

Closes #<issue-number>
Related to Phase 1, Task 1.1
```

### Branch Strategy

```bash
# Create feature branch
git checkout -b feat/hybrid-tools-phase-1

# Work on tasks 1.1-1.4
git commit -m "feat(hybrid-tools): task 1.1 - ai_tool input"
git commit -m "feat(hybrid-tools): task 1.2 - tool converter"

# Create PR when phase complete
git push origin feat/hybrid-tools-phase-1
```

---

## ❓ FAQ

### Q: Can I start without ARK API changes?
**A**: Yes! Phase 1-2 have no ARK API dependency. We build the mock API in Phase 2.

### Q: What if n8n tool has no schema?
**A**: Converter handles this gracefully with empty parameters object.

### Q: How do we handle tool name conflicts?
**A**: ARK tools take precedence in hybrid mode (configurable).

### Q: What's the performance impact?
**A**: ~350ms overhead per n8n tool call (measured in Phase 5).

### Q: Will this break existing workflows?
**A**: No. `ai_tool` connections are optional. Existing workflows unchanged.

---

## 📞 Support

- **Issues**: Create issue in GitHub repo
- **Questions**: Ask in project Slack channel
- **RFC Feedback**: Comment on RFC document

---

## 🎉 Success Criteria

Before declaring project complete:

- [ ] All 5 phases completed
- [ ] All unit tests pass (>80% coverage)
- [ ] E2E tests pass in CI/CD
- [ ] Performance benchmarks meet targets
- [ ] Documentation complete and accurate
- [ ] Sample workflows tested
- [ ] ARK API spec published
- [ ] Version v0.3.0 released

---

**Ready to start?** Open [task-1.1-ai-tool-input.md](./task-1.1-ai-tool-input.md) and let's build this! 🚀
