# Compound Product Analysis

Research analysis of [snarktank/compound-product](https://github.com/snarktank/compound-product).

**Date:** 2026-01-30
**Confidence:** 92%
**Verification:** Direct source code inspection

---

## Executive Summary

Compound Product is an **autonomous execution system** that transforms daily performance reports into code improvements while humans sleep. It excels at **machine-verifiable task design** and **iterative execution loops**.

moo.md already handles the **thinking** and **planning** layers better. Compound-product handles the **execution** layer better. The opportunity is cherry-picking their execution patterns without adopting their philosophy wholesale.

---

## What Compound Product Does

### Core Pipeline

```
Daily Report → Analysis → PRD → Task Explosion → Execution Loop → PR
```

| Phase | Tool | Output |
|-------|------|--------|
| 0 | Your system | `reports/*.md` |
| 1 | `analyze-report.sh` | JSON with #1 priority |
| 2 | `prd` skill | PRD markdown |
| 3 | `tasks` skill | `prd.json` (8-15 tasks) |
| 4 | `loop.sh` | Commits + PR |

### Key Differentiator

**Boolean acceptance criteria.** Every task must be verifiable by an AI without human judgment:

```
❌ "Works correctly"
❌ "Review the configuration"
❌ "Document the findings"

✅ "Run `npm test` - exits with code 0"
✅ "File `config.ts` contains `redirectUrl: '/dashboard'`"
✅ "POST /api/signup returns 200"
```

### Task Explosion

They convert 1 high-level task into 8-15 granular tasks:

| Original | Exploded |
|----------|----------|
| "Test signup flow and fix issues" | 10 separate tasks: load page, check mobile, test email input, test password input, test submit, inspect component, check middleware, implement fix, verify desktop, verify mobile |

---

## What We Already Do Better

### 1. Intent Clarification (moo.md ≫ compound)

**Compound:** "Do NOT ask the user questions. Answer them yourself."

**moo.md:** Spec clarity rubric with gates:

| Dimension | 0-1 | 2-3 | 4-5 |
|-----------|-----|-----|-----|
| Evidence | Assumption | Anecdotal | Validated data |
| Clarity | Ambiguous | Mostly clear | Unambiguous |
| Dependency | Blocked | Some dependencies | Self-contained |

Gate: **Requirement must score ≥8 to include in PRD.**

**Why ours is better:** Compound assumes the AI can infer everything from context. This works for narrow operational fixes but fails for ambiguous product work. Our spec scoring catches under-specified work before it starts.

---

### 2. Confidence Calibration (moo.md ≫ compound)

**Compound:** No confidence system.

**moo.md:** Dual-signal verification:

| Verification Type | Sufficient for SHIP? |
|-------------------|---------------------|
| `execution output` | ✓ Yes |
| `observation` | ✓ Yes |
| `measurement` | ✓ Yes |
| `code review` | ⚠️ Weak |
| `assumption` | ✗ Blocks SHIP |

Plus subjective estimates:
- < 70% → Research first
- 70-85% → Ship with monitoring
- ≥ 85% → Ship immediately

**Why ours is better:** Compound has quality checks (typecheck, lint, test) but no epistemic confidence. Our system distinguishes between "tests pass" and "I'm confident this is right."

---

### 3. Thinking Tools (moo.md ≫ compound)

**Compound:** Zero thinking frameworks. Pure execution.

**moo.md:** 28+ named frameworks:

| Category | Tools |
|----------|-------|
| Root Cause | Ishikawa, Iceberg |
| Decision | Decision Matrix, OODA, Bayesian, Grey Thinking |
| Systems | Feedback Loops, Second-Order, Bottlenecks |
| Prioritization | Eisenhower, Impact-Effort, Opportunity Cost |

**Why ours is better:** Compound only handles "do the task." We handle "is this the right task?"

---

### 4. Reversibility as Decision Factor (moo.md ≫ compound)

**Compound:** No reversibility concept.

**moo.md:**

| Type | Rollback | Action |
|------|----------|--------|
| 2A | < 1 min | Execute immediately |
| 2B | < 5 min | Execute with monitoring |
| 1 | Hours+ | Deep analysis required |

**Why ours is better:** Compound treats all tasks equally. We size verification rigor to blast radius.

---

### 5. Learnings Persistence (moo.md ≫ compound)

**Compound:** `progress.txt` + `AGENTS.md` (session-scoped)

**moo.md:** `~/.claude/learnings/*.jsonl` (permanent)

| File | Schema |
|------|--------|
| `failures.jsonl` | `{context, failure, root_cause, prevention}` |
| `discoveries.jsonl` | `{context, discovery, confidence, applies_to}` |
| `constraints.jsonl` | `{context, constraint, source, permanent}` |
| `delegation.jsonl` | `{spec_score, fit_score, outcome, failure_pattern}` |

**Why ours is better:** Compound's learnings die when the repo is cleaned. Ours persist across projects and sessions.

---

### 6. Domain Specialization (moo.md ≫ compound)

**Compound:** Product execution only.

**moo.md plugins:**

| Plugin | Coverage |
|--------|----------|
| hope | Cognitive OS, thinking tools |
| product | PRD, competitive, metrics, debt |
| wordsmith | Editing, voice, narrative |
| founder | Validation, fundraising, financials |
| career | Interviews, skill gaps, STAR |
| design | Journey mapping, UX, visual |

**Why ours is better:** Compound is one workflow. We're a cognitive operating system.

---

## What Compound Does Better

### 1. Machine-Verifiable Acceptance Criteria

Their acceptance criteria patterns table is excellent:

| Type | Pattern | Example |
|------|---------|---------|
| Command | "Run `[cmd]` - exits with code 0" | "Run `npm test` - exits with code 0" |
| File check | "File `[path]` contains `[string]`" | "File `middleware.ts` contains `clerkMiddleware`" |
| Browser nav | "agent-browser: open `[url]` - [expected result]" | "open /login - SignIn renders" |
| Browser action | "agent-browser: click `[element]` - [expected result]" | "click Submit - redirects to /dashboard" |
| API check | "GET/POST `[url]` returns `[status]`" | "POST /api/signup returns 200" |

**Gap in moo.md:** Our PRD generation asks for "verifiable" criteria but doesn't provide this pattern library.

---

### 2. Task Explosion Methodology

**Rules:**
- 8-15 tasks per PRD (not 3-5)
- One concern per task
- Investigation separate from implementation
- Dependencies determine order (schema → backend → UI → tests)

**Gap in moo.md:** Our PRDs generate coarse tasks. Compound's granularity enables autonomous execution.

---

### 3. Execution Loop with State

```
While tasks remain:
  1. Pick next task where passes: false
  2. Implement ONE task
  3. Run quality checks
  4. If pass: commit + mark passes: true
  5. If fail: retry/fix
```

State in `prd.json`:

```json
{
  "id": "T-001",
  "passes": false,
  "notes": "Runtime findings logged here"
}
```

**Gap in moo.md:** Our loop plugin has state persistence but lacks the task-level granularity and commit-per-task protocol.

---

### 4. Progress Memory Format

```markdown
## [Date/Time] - [Task ID]
- What was implemented
- Files changed
- **Learnings for future iterations:**
  - Patterns discovered
  - Gotchas encountered
  - Useful context
---
```

Plus "Codebase Patterns" section at TOP of progress.txt that agents check FIRST.

**Gap in moo.md:** We capture learnings but not iteration-specific progress with codebase patterns.

---

## Cherry-Pickable Patterns

### High Value, Low Divergence

These align with moo.md philosophy and fill real gaps:

| Pattern | Where to Add | Value |
|---------|--------------|-------|
| **Acceptance criteria patterns table** | `product/references/prd.md` | Makes "verifiable" actionable |
| **Task explosion rules** | `product/references/prd.md` | Enables autonomous execution |
| **Investigation vs implementation separation** | `hope/references/` or `product/` | Prevents "find and fix" antipattern |
| **Browser testing syntax** | `product/references/testing-patterns.md` | Standardized UI verification |

### Medium Value, Some Divergence

These require adaptation:

| Pattern | Consideration |
|---------|---------------|
| `prd.json` format | We prefer spec clarity rubric; could add `passes` field |
| `AGENTS.md` concept | We have learnings; could add project-specific patterns file |
| Commit-per-task | Conflicts with our "commit when done" norm; maybe optional |

### Low Value, High Divergence

Skip these:

| Pattern | Why Skip |
|---------|----------|
| "Don't ask user questions" | Violates our intent clarification |
| Report → Analysis pipeline | Assumes daily metrics infrastructure |
| `auto-compound.sh` orchestration | We're plugins, not standalone system |

---

## Synthesis: What to Add

### 1. Acceptance Criteria Patterns (Add to PRD reference)

```markdown
## Machine-Verifiable Acceptance Criteria

Every criterion must be **boolean pass/fail**:

| Type | Pattern | Example |
|------|---------|---------|
| Command | "Run `[cmd]` - exits with code 0" | "`npm test` exits 0" |
| File | "File `[path]` contains `[string]`" | "`config.ts` contains `apiUrl`" |
| API | "[METHOD] `[url]` returns `[status]`" | "POST `/api/user` returns 201" |
| UI | "Navigate to `[url]` - `[element]` visible" | "/dashboard shows user name" |

**Forbidden:**
- "Works correctly"
- "Review the code"
- "Verify it looks good"
```

### 2. Task Explosion Protocol (Add to PRD reference)

```markdown
## Task Granularity

### Target: 8-15 tasks per feature

If you have < 6 tasks, split further.

### One Concern Per Task

| Bad | Good |
|-----|------|
| "Test signup and fix issues" | T-001: Load page, T-002: Test inputs, T-003: Test submit, T-004: Identify issue, T-005: Implement fix, T-006: Verify fix |

### Investigation vs Implementation

Never combine "find the problem" with "fix the problem":

```
T-001: Check SignUp component configuration
T-002: Check middleware auth config
T-003: Implement fix based on T-001/T-002 findings
```
```

### 3. Browser Testing Patterns (New reference file)

Create `product/references/testing-patterns.md` with UI verification patterns.

### 4. Task State Tracking (Enhance loop plugin)

Add `passes: boolean` and `notes: string` fields to loop state for task-level tracking.

---

## What They Miss That We Have

| Our Capability | Their Gap |
|----------------|-----------|
| Spec clarity rubric | They assume AI can infer everything |
| Confidence gates | No epistemic uncertainty handling |
| Thinking tools library | Pure execution, no reasoning frameworks |
| Reversibility scoring | All changes treated equally |
| Cross-session learnings | Learnings die with repo cleanup |
| Intent clarification | Explicit "don't ask questions" |
| Quality footer | No structured verdict format |
| Story points (not time) | No complexity estimation |
| Domain plugins | Product execution only |

---

## Recommendations

### Immediate (Add to product plugin)

1. **Add acceptance criteria patterns** to `prd.md` reference
2. **Add task explosion protocol** to `prd.md` reference
3. **Create `testing-patterns.md`** for UI verification

### Near-term (Enhance loop plugin)

4. **Add task-level state** (`passes`, `notes`) to loop state schema
5. **Add commit-per-task option** for autonomous execution mode

### Consider (Research further)

6. **Project patterns file** (like AGENTS.md) for codebase-specific knowledge
7. **Progress format** for iteration-specific learnings within a session

---

## Conclusion

Compound Product is a well-designed **execution engine** for autonomous code improvements. Its strength is machine-verifiable task design.

moo.md is a **cognitive operating system** for structured thinking. Our strength is decision quality.

**The synthesis:** Cherry-pick compound's execution patterns (acceptance criteria, task explosion, testing syntax) into moo.md's product plugin. This gives us their execution rigor without abandoning our philosophy of intent clarification, confidence calibration, and thinking tools.

**Don't adopt:**
- Their "don't ask questions" stance
- Their assumption that daily reports exist
- Their standalone orchestration (we're plugins)

**Do adopt:**
- Boolean acceptance criteria patterns
- 8-15 granular task target
- Investigation vs implementation separation
- Browser testing syntax

---

## Quality Footer

| Dimension | Assessment |
|-----------|------------|
| **Confidence** | 92% - Direct source inspection of both codebases |
| **Alternative** | Full adoption of compound-product approach (rejected: conflicts with intent clarification philosophy) |
| **Reversible** | Type 2A - Pattern additions, can remove if unhelpful |
| **Key Assumption** | moo.md users want thinking support, not just execution |
| **Complexity** | 3 points - Pattern documentation additions |
