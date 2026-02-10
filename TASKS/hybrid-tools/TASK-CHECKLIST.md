# Task Checklist - Quick Reference

Copy this checklist for each task you work on.

---

## Task: ___________________________

**Estimated Time**: ____h | **Actual Time**: ____h

---

## ☐ Step 1: SCOPE (15-30 min)

```bash
cat TASKS/hybrid-tools/task-X.X-*.md
```

- [ ] Read task file completely
- [ ] Understand objective and background
- [ ] Review acceptance criteria (defines "done")
- [ ] Note files that will change
- [ ] Check dependencies (blockers cleared?)

**Exit**: I can explain this task in my own words ✅

---

## ☐ Step 2: PLAN (30-45 min)

```bash
# Find patterns
grep -r "similar_code" nodes/
cat nodes/test-helpers/mocks.ts
```

- [ ] Review implementation section
- [ ] Design test scenarios (write them down)
- [ ] Identify edge cases
- [ ] Plan TDD approach (tests first!)

**Exit**: I have a clear test plan ✅

---

## ☐ Step 3: IMPLEMENT (2-3 hours)

### TDD Cycle (repeat for each test)

```bash
npm run test:watch -- <test-file>
```

- [ ] **🔴 RED**: Write failing test
- [ ] **🟢 GREEN**: Write minimal code to pass
- [ ] **🔄 REFACTOR**: Clean up code
- [ ] Repeat for next test scenario

**Exit**: All unit tests written and passing ✅

---

## ☐ Step 4: TEST (30-45 min)

```bash
npm test
npm run test:coverage
```

- [ ] All tests pass: `npm test`
- [ ] Coverage >80%: `npm run test:coverage`
- [ ] Run tests 5 times (no flakiness)
- [ ] Edge cases covered

**Exit**: >80% coverage, all tests pass consistently ✅

---

## ☐ Step 5: VERIFY (30-45 min)

### Automated Checks

```bash
npm run lint       # ✅ 0 errors
npm run lintfix    # Auto-fix
npm run build      # ✅ dist/ created
npm test           # ✅ All pass
```

- [ ] **Lint**: `npm run lint` → 0 errors
- [ ] **Build**: `npm run build` → succeeds
- [ ] **Tests**: All passing

### Acceptance Criteria

Go through every item in task file:

- [ ] Criterion 1: _____________________
- [ ] Criterion 2: _____________________
- [ ] Criterion 3: _____________________
- [ ] Criterion 4: _____________________
- [ ] Criterion 5: _____________________

### Manual Testing (if applicable)

```bash
devspace dev
# Open http://localhost:5678
```

- [ ] Feature works in n8n UI
- [ ] No console errors
- [ ] Logs look correct

**Exit**: All quality gates pass, all criteria met ✅

---

## ☐ Step 6: COMPLETE (15-30 min)

### Commit

```bash
git status
git diff
git add <files>
git commit -m "feat(hybrid-tools): <subject>

<detailed description>

Coverage: XX%
Task: X.X
"
```

- [ ] Changes reviewed with `git diff`
- [ ] Committed with descriptive message
- [ ] Task status updated to `completed`

### Final Check

```bash
# Clean build
rm -rf dist node_modules
npm install
npm run build
npm test
npm run lint
```

- [ ] Full clean build passes
- [ ] Documentation updated (if needed)
- [ ] Next task reviewed

**Exit**: Task complete, ready for next! ✅

---

## 🚨 Quality Gates (Must Pass!)

| Gate | Command | Status |
|------|---------|--------|
| Tests | `npm test` | ☐ ✅ |
| Coverage | `npm run test:coverage` | ☐ ✅ >80% |
| Lint | `npm run lint` | ☐ ✅ 0 errors |
| Build | `npm run build` | ☐ ✅ Success |
| Acceptance | Manual review | ☐ ✅ All met |

**ALL MUST BE ✅ BEFORE NEXT TASK**

---

## Notes / Issues Encountered

```
(Space for notes during implementation)







```

---

## Time Tracking

| Activity | Estimated | Actual |
|----------|-----------|--------|
| Scope | 30 min | ____ |
| Plan | 45 min | ____ |
| Implement | 2-3h | ____ |
| Test | 45 min | ____ |
| Verify | 45 min | ____ |
| Complete | 30 min | ____ |
| **Total** | **4-5h** | **____** |

---

## ✅ Task Complete!

- [x] All steps completed
- [x] All quality gates passed
- [x] Code committed
- [x] Task status updated
- [x] Ready for next task

**Date Completed**: _______________

**Next Task**: _______________

---

**Print this checklist and check off items as you go!** ✓
