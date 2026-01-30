# How Compound-Product Actually Works

Deep analysis of the mechanics and design rationale.

---

## The Core Problem They Solve

**Question:** How do you make an AI agent execute reliably while humans sleep?

**Answer:** Remove all ambiguity. Decompose to atomic units. Verify mechanically.

---

## The Execution Loop (How)

```
┌─────────────────────────────────────────────────────────┐
│  loop.sh                                                │
│                                                         │
│  for i in 1..MAX_ITERATIONS:                            │
│    1. Inject prompt (CLAUDE.md)                         │
│    2. Agent reads:                                      │
│       - compound.config.json (settings)                 │
│       - prd.json (task list with passes: true/false)    │
│       - progress.txt (Codebase Patterns at TOP)         │
│    3. Agent picks FIRST task where passes: false        │
│    4. Agent implements ONE task                         │
│    5. Agent runs quality checks                         │
│    6. If pass: commit + mark passes: true               │
│    7. Agent outputs to stdout                           │
│    8. Shell greps for <promise>COMPLETE</promise>       │
│       - If found: exit 0                                │
│       - If not: continue loop                           │
└─────────────────────────────────────────────────────────┘
```

**Key insight:** The agent has NO memory between iterations. All state is external:

| State | Storage | Persists Across |
|-------|---------|-----------------|
| Which tasks are done | `prd.json` (passes field) | Iterations |
| What was learned | `progress.txt` | Iterations |
| Codebase patterns | `AGENTS.md` | Projects |
| Code changes | Git commits | Forever |

---

## Why Boolean Acceptance Criteria

The fundamental constraint of autonomous execution:

> **You can only delegate what you can specify precisely.**

An agent cannot evaluate:
- "Works correctly" → What does "correctly" mean?
- "Looks good" → By whose aesthetic?
- "Is fast enough" → What threshold?

An agent CAN evaluate:
- "Exit code is 0" → Run command, check code
- "File contains X" → Read file, grep for X
- "HTTP status is 200" → Make request, check status

**This is not a limitation of AI. It's a limitation of specification.**

The pattern table exists because these are the ONLY verification types an agent can perform without human judgment:

| Type | Agent Action | Verification |
|------|--------------|--------------|
| Command | `bash -c "cmd"` | Exit code |
| File | `cat file \| grep` | String match |
| API | `curl -X METHOD` | Status code |
| Browser | `agent-browser` | DOM state |

---

## Why 8-15 Tasks (Not 3-5)

### 1. Context Window Sizing

Each task must fit in ONE agent iteration. Claude's context window is large but not infinite.

```
3 tasks = large chunks = context overflow risk
15 tasks = small chunks = fits safely
```

### 2. Atomicity = Rollback Safety

Each task = one commit. If task 7 breaks something:

```
git revert HEAD~3  # Undo tasks 7, 8, 9
```

With 3 large tasks, reverting one undoes too much work.

### 3. Dependency Clarity

```
❌ "Build the feature"
   - What order? Unknown.
   - What depends on what? Unknown.

✅ T-001: Create schema
   T-002: Add backend route (depends on T-001)
   T-003: Add UI component (depends on T-002)
   T-004: Verify in browser (depends on T-003)
   - Order: Explicit
   - Dependencies: Explicit
```

---

## Why "Don't Ask Questions"

This is the **opposite** of moo.md's philosophy. But it solves their specific problem:

```
Scenario: Compound runs at 3 AM via cron job
Human: Sleeping
Agent: "Should I use approach A or B?"
Response: None
Result: Agent blocked forever
```

**Their tradeoff:**
- Lower correctness (agent guesses)
- Higher autonomy (works unattended)

**Our tradeoff:**
- Higher correctness (human clarifies)
- Lower autonomy (requires presence)

Neither is wrong. They optimize for different constraints.

---

## Why Investigation vs Implementation

Cognitive mode separation:

| Mode | Goal | Output |
|------|------|--------|
| Investigation | Understand | Notes (findings) |
| Implementation | Change | Code (commits) |

**Why separate?**

```
❌ "Find and fix the bug"
   - Agent conflates discovery with action
   - If fix fails, unclear if diagnosis was wrong or fix was wrong

✅ T-001: Check config file, log routing prop to notes
   T-002: Check middleware, log public routes to notes
   T-003: Based on T-001/T-002 notes, implement fix
   - Diagnosis preserved in notes
   - Fix can reference diagnosis
   - If fix fails, notes show what agent believed
```

**State passing between iterations:**
1. Investigation task writes to `notes` field in prd.json
2. Implementation task reads `notes` from previous tasks
3. No context sharing needed—state is in files

---

## Why "Codebase Patterns" at TOP of progress.txt

Agents read linearly. Token budget is limited.

```
┌─────────────────────────────────────────┐
│ ## Codebase Patterns                    │  ← Agent reads FIRST
│ - Use sql template for aggregations     │
│ - Always IF NOT EXISTS for migrations   │
├─────────────────────────────────────────┤
│ ## 2024-01-15 - T-001                   │  ← Older iterations
│ - Did X                                 │
│ ## 2024-01-15 - T-002                   │
│ - Did Y                                 │
│ ...                                     │
│ (truncated if context limit hit)        │
└─────────────────────────────────────────┘
```

General patterns are more valuable than specific task history. Put them first.

**This is learnings consolidation:** Individual learnings bubble up to patterns.

---

## The Completion Protocol

Shell script doesn't parse JSON or understand task completion. It only knows one thing:

```bash
if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
  exit 0
fi
```

Agent is responsible for:
1. Checking if all tasks have `passes: true`
2. Outputting the magic string if complete

This is **dumb orchestration + smart agent**:
- Shell: Simple loop, simple check
- Agent: Complex reasoning, state management

---

## What They Don't Have (Our Advantages)

| Capability | Compound-Product | moo.md |
|------------|------------------|--------|
| Intent clarification | None ("don't ask") | Spec clarity rubric |
| Confidence tracking | Binary (passes/fails) | Dual-signal (type + %) |
| Thinking frameworks | Zero | 28+ tools |
| Cross-project learning | None | `~/.claude/learnings/` |
| Reversibility assessment | None | Type 2A/2B/1 |
| Human collaboration | Minimal (PR review) | Throughout |

**They built an execution engine. We built a thinking system.**

---

## Synthesis: What to Actually Learn

### 1. Operationalize "Verifiable"

We say criteria should be "verifiable" but don't show how. Their pattern table does:

```
Command → exit code
File → contains string
API → status code
Browser → element state
```

**Add this to our PRD skill.**

### 2. Context Window Awareness

Task size should fit in one context window. Their 8-15 rule is a proxy for this.

**For autonomous (loop) mode:** Enforce granularity.
**For collaborative mode:** Can be coarser (human helps if stuck).

### 3. Investigation/Implementation Split

Universal principle. Don't conflate "understand" with "change."

**Add this as a pattern in our skills.**

### 4. State as Files

For multi-iteration work, state must live outside the agent. They use:
- `prd.json` → Task completion state
- `progress.txt` → Learnings
- `AGENTS.md` → Codebase patterns

**Our loop plugin has `.loop/state.json`. Could add patterns file.**

### 5. Don't Copy Their Philosophy

"Don't ask questions" works for unattended execution. It's wrong for collaborative work.

Keep our intent clarification. Add their execution rigor as an option for autonomous mode.

---

## The Real Insight

> Compound-product answers: "How do I make an agent DO things reliably?"
>
> moo.md answers: "How do I make an agent THINK things correctly?"

They're complementary layers:

```
┌─────────────────────────────────────┐
│ What should we build?               │ ← moo.md (intent, confidence)
├─────────────────────────────────────┤
│ How do we specify it for execution? │ ← PRD with boolean criteria
├─────────────────────────────────────┤
│ How do we execute autonomously?     │ ← compound-product (loop)
└─────────────────────────────────────┘
```

We strengthen the thinking layer. They strengthen the execution layer. Cherry-pick their execution patterns. Don't abandon our thinking philosophy.

---

## Quality Footer

| Dimension | Assessment |
|-----------|------------|
| **Confidence** | 95% - Direct source code analysis |
| **Alternative** | Adopt their philosophy wholesale (rejected: wrong fit for collaborative work) |
| **Reversible** | Type 2A - Documentation additions |
| **Key Assumption** | moo.md users want thinking support, not just execution |
| **Complexity** | 3 points |
