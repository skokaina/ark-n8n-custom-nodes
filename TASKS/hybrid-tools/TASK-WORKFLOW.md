# Standard Task Workflow - Hybrid Tools Project

## Overview

Every task follows this **6-step workflow** to ensure quality, completeness, and smooth progression through the project.

```
1. SCOPE → 2. PLAN → 3. IMPLEMENT → 4. TEST → 5. VERIFY → 6. COMPLETE
```

---

## Step 1: SCOPE 📋

**Goal**: Understand the task completely before writing any code.

### Checklist

- [ ] Read task file completely (`TASKS/hybrid-tools/task-X.X-*.md`)
- [ ] Understand the **Objective** section
- [ ] Review **Background** for context
- [ ] Identify all **Files Changed**
- [ ] Note **Dependencies** (blocked by which tasks?)
- [ ] Read **Acceptance Criteria** - these define "done"
- [ ] Check **Estimated Effort** - plan your time

### Commands

```bash
# Read the task
cat TASKS/hybrid-tools/task-1.1-ai-tool-input.md

# Check task dependencies
# (Use task tracking system to verify blockers are completed)

# Read related files mentioned in task
cat nodes/nodes/ArkAgentAdvanced/ArkAgentAdvanced.node.ts
```

### Output

Create a **personal checklist** in a scratch file:

```markdown
# Task 1.1 - Personal Checklist

## What I'm building:
- Add ai_tool input connection to ArkAgentAdvanced
- Enable n8n AI tools to connect as sub-nodes

## Files I'll change:
- [ ] nodes/nodes/ArkAgentAdvanced/ArkAgentAdvanced.node.ts
- [ ] nodes/nodes/ArkAgentAdvanced/__tests__/ai-tool-input.test.ts (new)
- [ ] nodes/test-helpers/mocks.ts (extend)

## Acceptance criteria:
- [ ] ai_tool input connection type added
- [ ] Multiple tools can connect
- [ ] getInputConnectionData retrieves tools
- [ ] All unit tests pass (>80% coverage)
- [ ] No breaking changes
```

### Exit Criteria

✅ You can explain the task in your own words
✅ You know exactly which files you'll modify
✅ You understand what "done" looks like

---

## Step 2: PLAN 🎯

**Goal**: Design the implementation and test strategy before coding.

### Checklist

- [ ] Review **Implementation** section in task file
- [ ] Identify **test scenarios** from task description
- [ ] Plan **TDD approach** (tests first!)
- [ ] Identify **edge cases** to test
- [ ] Check for **existing patterns** in codebase

### Commands

```bash
# Find similar implementations
grep -r "ai_tool" nodes/
grep -r "getInputConnectionData" nodes/

# Look at existing tests for patterns
ls nodes/nodes/*/tests__/*.test.ts

# Check test helper utilities
cat nodes/test-helpers/mocks.ts
```

### Output

Create **test plan** (write this down):

```markdown
## Test Plan - Task 1.1

### Unit Tests to Write:
1. ✅ Node has ai_tool input defined
   - Check input type is 'ai_tool'
   - Check maxConnections is -1
   - Check required is false

2. ✅ Retrieves connected tools during execution
   - Mock single calculator tool
   - Verify getInputConnectionData called
   - Verify tool data accessible

3. ✅ Handles no connected tools gracefully
   - Empty connections object
   - Should not throw error

4. ✅ Handles multiple connected tools
   - 3 tools: calculator, web_search, http_request
   - Verify all retrieved

### Edge Cases:
- Invalid connection type
- Null/undefined tool data
- Tool with missing properties
```

### Exit Criteria

✅ You have a clear test plan
✅ You know the order: tests → implementation
✅ You've identified edge cases

---

## Step 3: IMPLEMENT 💻

**Goal**: Write code using TDD (Test-Driven Development).

### TDD Cycle (Red → Green → Refactor)

#### 3.1: Write Failing Tests First 🔴

```bash
# 1. Create test file
touch nodes/nodes/ArkAgentAdvanced/__tests__/ai-tool-input.test.ts

# 2. Write first test (will fail)
code nodes/nodes/ArkAgentAdvanced/__tests__/ai-tool-input.test.ts
```

**Example Test (failing initially)**:

```typescript
import { ArkAgentAdvanced } from '../ArkAgentAdvanced.node';

describe('ArkAgentAdvanced - AI Tool Input', () => {
  it('should have ai_tool input connection defined', () => {
    const node = new ArkAgentAdvanced();
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
});
```

**Run test (should FAIL)**:

```bash
cd nodes
npm test -- ai-tool-input.test.ts
# ❌ Expected: ai_tool input defined
# ❌ Actual: undefined
```

#### 3.2: Write Minimal Implementation 🟢

**Now implement just enough to pass the test**:

```typescript
// In ArkAgentAdvanced.node.ts
inputs: [
  'main',
  {
    displayName: 'Tools',
    type: 'ai_tool',
    maxConnections: -1,
    required: false,
  },
],
```

**Run test again (should PASS)**:

```bash
npm test -- ai-tool-input.test.ts
# ✅ All tests passed
```

#### 3.3: Refactor 🔄

Clean up code without changing behavior:

```typescript
// Extract to constant if used multiple places
const AI_TOOL_INPUT = {
  displayName: 'Tools',
  type: 'ai_tool' as const,
  maxConnections: -1,
  required: false,
};

inputs: ['main', AI_TOOL_INPUT],
```

**Run test again (should still PASS)**:

```bash
npm test -- ai-tool-input.test.ts
# ✅ All tests passed
```

#### 3.4: Repeat for Each Test Case

**For each test in your test plan**:
1. Write failing test
2. Implement minimal code to pass
3. Refactor
4. Run tests

### Checklist

- [ ] Write test first (RED)
- [ ] Implement minimal code (GREEN)
- [ ] Refactor if needed (REFACTOR)
- [ ] Repeat for all test scenarios
- [ ] All tests passing before moving on

### Commands

```bash
# Watch mode (tests re-run on file save)
npm run test:watch -- ai-tool-input.test.ts

# Run all tests for this node
npm test -- ArkAgentAdvanced

# Check coverage for this file
npm run test:coverage -- ai-tool-input.test.ts
```

### Exit Criteria

✅ All unit tests written and passing
✅ Implementation complete
✅ Code is clean and readable

---

## Step 4: TEST 🧪

**Goal**: Ensure comprehensive test coverage and quality.

### Checklist

- [ ] **Run all unit tests**: `npm test`
- [ ] **Check coverage**: `npm run test:coverage`
- [ ] **Verify >80% coverage** for files you changed
- [ ] **Test edge cases** explicitly
- [ ] **No skipped/pending tests** (`.skip`, `.todo`)

### Commands

```bash
cd nodes

# 1. Run all tests
npm test
# ✅ All tests should pass

# 2. Check coverage
npm run test:coverage

# Expected output:
# File                              | % Stmts | % Branch | % Funcs | % Lines |
# ----------------------------------|---------|----------|---------|---------|
# ArkAgentAdvanced.node.ts          |   85.2  |   78.3   |   90.0  |   85.2  |
# toolConverter.ts                  |   92.1  |   88.7   |   95.0  |   92.1  |

# 3. Run tests multiple times (check for flakiness)
for i in {1..5}; do npm test -- ai-tool-input.test.ts; done
# All runs should pass

# 4. Test in watch mode during development
npm run test:watch
```

### Coverage Thresholds

| Metric | Minimum | Target |
|--------|---------|--------|
| Statements | 80% | 90%+ |
| Branches | 75% | 85%+ |
| Functions | 80% | 90%+ |
| Lines | 80% | 90%+ |

### What if coverage is low?

```bash
# Generate detailed HTML coverage report
npm run test:coverage

# Open in browser
open coverage/lcov-report/index.html

# Find uncovered lines (red highlights)
# Write additional tests for those scenarios
```

### Exit Criteria

✅ All tests pass consistently
✅ Coverage >80% (ideally >90%)
✅ No flaky tests
✅ Edge cases covered

---

## Step 5: VERIFY ✅

**Goal**: Ensure task acceptance criteria are met and code quality is high.

### 5.1: Lint Check

```bash
cd nodes

# Run ESLint
npm run lint

# Expected: No errors
# ✅ All files pass linting

# Auto-fix simple issues
npm run lintfix
```

**Common lint errors and fixes**:

```typescript
// ❌ Error: Missing semicolon
const foo = 'bar'

// ✅ Fix: Add semicolon
const foo = 'bar';

// ❌ Error: Unused variable
const unusedVar = 123;

// ✅ Fix: Remove or use it
// (removed)

// ❌ Error: Any type used
function process(data: any) { }

// ✅ Fix: Use proper type
function process(data: unknown) { }
```

### 5.2: TypeScript Compilation

```bash
cd nodes

# Build TypeScript (compilation check)
npm run build

# Expected: No errors
# ✅ Successfully compiled
# dist/ directory created with .js files
```

**Common TypeScript errors and fixes**:

```typescript
// ❌ Error: Property 'name' does not exist on type 'Tool'
const name = tool.name;

// ✅ Fix: Add type guard or proper typing
interface Tool {
  name: string;
  description: string;
}
const name = (tool as Tool).name;

// ❌ Error: Type 'undefined' is not assignable to type 'string'
const value: string = maybeValue;

// ✅ Fix: Handle undefined
const value: string = maybeValue ?? 'default';
```

### 5.3: Manual Testing (if applicable)

```bash
# Build and test locally
npm run build

# Start DevSpace for manual testing
cd ..
devspace dev

# In browser: http://localhost:5678
# 1. Create new workflow
# 2. Add ARK Agent Advanced node
# 3. Add Calculator tool
# 4. Connect Calculator → ARK Agent Advanced (Tools input)
# 5. Verify connection appears
# 6. Check logs: kubectl logs deployment/ark-n8n
```

### 5.4: Acceptance Criteria Review

Go through **every item** in task's acceptance criteria:

```markdown
## Task 1.1 Acceptance Criteria

- [x] ai_tool input connection type added ✅
  - Verified in code: inputs array includes ai_tool object

- [x] Multiple tools can connect (maxConnections: -1) ✅
  - Test passes: multiple tools test

- [x] getInputConnectionData('ai_tool', 0) retrieves tools ✅
  - Test passes: tool retrieval test

- [x] All unit tests pass with >80% coverage ✅
  - npm test: ✅ All pass
  - Coverage: 87.3% ✅

- [x] No breaking changes to existing workflows ✅
  - Existing tests still pass
  - Backward compatible (ai_tool is optional)
```

### Checklist

- [ ] **Linting**: `npm run lint` passes with 0 errors
- [ ] **Building**: `npm run build` succeeds, dist/ created
- [ ] **All tests pass**: `npm test` shows all green
- [ ] **Coverage >80%**: `npm run test:coverage` confirms
- [ ] **Manual testing**: Feature works in n8n UI (if applicable)
- [ ] **Acceptance criteria**: Every item checked off
- [ ] **No console errors**: Check browser console, server logs

### Exit Criteria

✅ All automated checks pass (lint, build, test)
✅ Manual testing confirms feature works
✅ Every acceptance criterion met
✅ Code is production-ready

---

## Step 6: COMPLETE 🎉

**Goal**: Commit code, update task status, and prepare for next task.

### 6.1: Commit Changes

```bash
# Check what changed
git status

# Review changes
git diff

# Stage files
git add nodes/nodes/ArkAgentAdvanced/ArkAgentAdvanced.node.ts
git add nodes/nodes/ArkAgentAdvanced/__tests__/ai-tool-input.test.ts

# Commit with descriptive message
git commit -m "feat(hybrid-tools): add ai_tool input connection to ArkAgentAdvanced

- Add ai_tool input type with maxConnections: -1
- Implement getInputConnectionData for retrieving connected tools
- Add unit tests for ai_tool connection handling
- Add tests for multiple tools and edge cases

Coverage: 87.3%
Task: 1.1 - Add ai_tool input connection
Phase: 1 - Foundation

Acceptance criteria met:
✅ ai_tool input connection type added
✅ Multiple tools can connect
✅ getInputConnectionData retrieves tools successfully
✅ All unit tests pass (>80% coverage)
✅ No breaking changes to existing workflows
"
```

**Commit Message Format**:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Examples**:

```
feat(hybrid-tools): implement tool converter with Zod to JSON Schema

test(hybrid-tools): add edge case tests for tool converter

fix(hybrid-tools): handle tools with no schema gracefully

docs(hybrid-tools): update README with tool source modes
```

### 6.2: Update Task Status

```bash
# Mark task as completed
# (Use task tracking system to update status)
```

**Task update includes**:
- Status: `pending` → `completed`
- Completion notes: what was delivered
- Any deviations from original plan
- Links to commits

### 6.3: Run Full Test Suite

Before declaring complete, run **everything one more time**:

```bash
cd nodes

# Clean build
rm -rf dist node_modules
npm install
npm run build
npm test
npm run lint

# All should pass ✅
```

### 6.4: Update Documentation

If task involves user-facing changes:

```bash
# Update CHANGELOG (if not done yet)
echo "## Task 1.1 Complete
- Added ai_tool input connection to ArkAgentAdvanced
- Users can now connect n8n AI tool sub-nodes
" >> TASKS/hybrid-tools/CHANGELOG.md

# Update README if needed
# (Usually done in Phase 5, but note any important changes)
```

### 6.5: Prepare for Next Task

```bash
# Check next task dependencies
cat TASKS/hybrid-tools/task-1.2-tool-converter.md

# Verify blockers are cleared
# Task 1.2 depends on Task 1.1 ✅ (now complete)

# Read next task overview
# Get ready to start Step 1 (SCOPE) for Task 1.2
```

### Checklist

- [ ] **Changes committed** with descriptive message
- [ ] **Task status updated** to `completed`
- [ ] **Full test suite passes** (clean build)
- [ ] **Documentation updated** (if needed)
- [ ] **Next task reviewed** and ready to start
- [ ] **Celebratory coffee** ☕ (optional but recommended)

### Exit Criteria

✅ Code committed to version control
✅ Task marked complete in tracking system
✅ Ready to start next task
✅ You feel confident the task is done right

---

## 🔄 Complete Workflow Checklist

Use this **master checklist** for every task:

### Before Coding
- [ ] Step 1: SCOPE - Read and understand task completely
- [ ] Step 2: PLAN - Design implementation and test strategy

### During Coding
- [ ] Step 3: IMPLEMENT - TDD cycle (Red → Green → Refactor)
  - [ ] Write failing test
  - [ ] Implement minimal code
  - [ ] Refactor
  - [ ] Repeat

### After Coding
- [ ] Step 4: TEST - Run all tests, check coverage
  - [ ] `npm test` - all pass
  - [ ] `npm run test:coverage` - >80%
  - [ ] No flaky tests

- [ ] Step 5: VERIFY - Quality checks and acceptance criteria
  - [ ] `npm run lint` - 0 errors
  - [ ] `npm run build` - succeeds
  - [ ] Manual testing - works
  - [ ] All acceptance criteria met

- [ ] Step 6: COMPLETE - Commit and update
  - [ ] Git commit with good message
  - [ ] Task status → completed
  - [ ] Next task prepared

---

## 📊 Quality Gates

**Do NOT proceed to next task unless**:

| Gate | Command | Expected Result |
|------|---------|-----------------|
| Tests Pass | `npm test` | ✅ 0 failures |
| Coverage | `npm run test:coverage` | ✅ >80% |
| Linting | `npm run lint` | ✅ 0 errors |
| Build | `npm run build` | ✅ dist/ created |
| Acceptance | Manual review | ✅ All criteria met |

**If any gate fails**: Fix it before moving on. No exceptions.

---

## 🎯 Example: Task 1.1 Walkthrough

**Estimated time**: 4 hours (including breaks)

### Hour 1: Scope + Plan
- 15 min: Read task-1.1-ai-tool-input.md thoroughly
- 15 min: Review ArkAgentAdvanced.node.ts current state
- 15 min: Look at similar nodes for patterns
- 15 min: Write test plan with 4 test scenarios

### Hour 2: Implement (TDD)
- 20 min: Write first test (ai_tool input defined) + make it pass
- 20 min: Write second test (retrieve tools) + make it pass
- 20 min: Write third test (no tools) + make it pass

### Hour 3: Implement + Test
- 20 min: Write fourth test (multiple tools) + make it pass
- 20 min: Refactor code for clarity
- 20 min: Run coverage, identify gaps, add tests

### Hour 4: Verify + Complete
- 15 min: Run lint, fix issues
- 15 min: Run build, fix TypeScript errors
- 15 min: Manual testing in n8n UI
- 15 min: Git commit, update task, review next task

**Result**: Task 1.1 complete, ready for Task 1.2! 🎉

---

## 💡 Pro Tips

1. **Never skip tests** - They save time in debugging later
2. **Small commits** - Commit after each test passes
3. **Take breaks** - Step away when stuck
4. **Ask for help** - If blocked >30 min, ask (me or team)
5. **Document surprises** - Note unexpected issues for team
6. **Celebrate wins** - Each completed task is progress!

---

## 🚨 Common Pitfalls

### ❌ Don't:
- Skip writing tests ("I'll add them later")
- Write all code first, then test
- Ignore coverage gaps
- Commit with failing tests
- Move to next task with lint errors

### ✅ Do:
- Write tests first (TDD)
- Keep test:code ratio high (1:1 or better)
- Fix all quality gates before committing
- Review acceptance criteria before starting
- Update task status immediately when done

---

## 📞 Getting Help

**If you're stuck**:

1. **Check task file** - Re-read implementation section
2. **Look at examples** - Find similar code in codebase
3. **Run tests** - Error messages often point to issue
4. **Ask me** - "I'm stuck on task 1.X, specifically [problem]"

**Useful debugging commands**:

```bash
# See what files changed
git status
git diff

# Run single test file
npm test -- <test-file-name>

# Run tests in watch mode (auto-rerun on save)
npm run test:watch

# See detailed test output
npm test -- --verbose

# Check TypeScript errors
npx tsc --noEmit
```

---

**Ready to start?** Follow this workflow for **every task** and you'll have high-quality, well-tested code! 🚀
