---
name: start
description: Start autonomous iteration loop OR explain how Loop works. Triggers on "loop", "keep going", "don't stop", "continue until done", "until tests pass", "implement full feature", "fix all problems", "make better", "what is loop", "how does loop work", "loop help", or any persistence pattern. Executes multi-step tasks without stopping until complete or limits reached.
---

# Loop

Autonomous iteration that continues until spec is satisfied or limits reached.

## Before You Start (Required Checklist)

□ Score the spec (use rubric below)
□ Determine shape (Tool ≥8, Colleague 5-7, Intent <5)
□ Extract success criteria from spec (explicit list)
□ Decompose into concrete steps
□ Create task with state schema
□ Write `.loop/state.json` with criteria array
□ Announce: `[LOOP] Starting | Shape: X | Steps: N | Budget: $Y`

**If any checkbox is unclear, STOP and clarify before proceeding.**

---

## Spec Clarity Rubric (Inline)

Score on 5 dimensions (0-2 each, max 10):

| Dimension | 0 | 1 | 2 |
|-----------|---|---|---|
| **Outcome** | "Make it better" | "Improve performance" | "p95 latency <100ms" |
| **Scope** | "Fix the app" | "Fix auth" | "Fix /api/auth/token" |
| **Constraints** | None stated | "Use existing stack" | "No new deps, <500 LOC" |
| **Success** | None stated | "Tests pass" | "All tests + manual QA" |
| **Done** | Implied | "When it works" | "PR merged to main" |

**Decision:**
- **≥8:** Tool-shaped — execute silently, report on completion
- **5-7:** Colleague-shaped — check in after each iteration
- **<5:** Run `/hope:intent` first

---

## State Schema (Required)

Create task with this exact structure:

```json
{
  "subject": "Loop: [one-line spec summary]",
  "description": "Full spec with success criteria",
  "metadata": {
    "iteration": 1,
    "cost": 0,
    "shape": "tool|colleague",
    "budget": 25,
    "maxIterations": 10,
    "steps": ["step1", "step2", "step3"],
    "completedSteps": [],
    "errors": []
  }
}
```

---

## Rigid Enforcement Gates

**These outputs are MANDATORY. The Stop hook checks for them.**

### Before Each Iteration

```
[LOOP] Iteration N/max | Cost: $X/$budget | Step: [current step]
```

### After Each Iteration

```
[LOOP] ✓ [step name] complete | Progress: N/total | Next: [next step]
```

### On Completion (CRITICAL)

```
<loop-complete>
All success criteria satisfied:
- [criterion 1]: ✓
- [criterion 2]: ✓
- [criterion 3]: ✓
</loop-complete>
```

**The Stop hook looks for `<loop-complete>`. Without it, the loop continues.**

### On Pause

```
[LOOP] ⏸ Paused: [reason]
Progress: N steps complete, M remaining
Resume: /loop continue
```

---

## State File Protocol (Required)

After EVERY iteration, write `.loop/state.json`:

```json
{
  "spec": "original user request verbatim",
  "criteria": ["tests pass", "all routes refactored", "no lint errors"],
  "criteriaStatus": {
    "tests pass": false,
    "all routes refactored": false,
    "no lint errors": true
  },
  "steps": ["step1", "step2", "step3"],
  "completedSteps": ["step1"],
  "remainingSteps": ["step2", "step3"],
  "iteration": 2,
  "status": "in_progress"
}
```

**The stop hook reads this file to decide whether to continue.**

### Criteria Verification (Before `<loop-complete>`)

1. For each criterion in `criteria` array:
   - Run verification (test command, grep, etc.)
   - Update `criteriaStatus[criterion]` = true/false
2. Write updated state to `.loop/state.json`
3. Only if ALL criteriaStatus values are `true`:
   - Output `<loop-complete>` marker
   - Set `status: "completed"`

---

## Iteration Protocol

```
1. TaskGet → Retrieve current state
2. Read .loop/state.json if exists (recovery case)
3. Announce → [LOOP] Iteration N/max | Cost: $X | Step: [name]
4. Execute → Do ONE logical unit of work
5. Verify → Check affected criteria, update criteriaStatus
6. Write → .loop/state.json with updated state
7. TaskUpdate → Save to Tasks API (backup)
8. Announce → [LOOP] ✓ Step complete | Progress: N/total
9. Check → All criteriaStatus true? Output <loop-complete>
→ Stop hook evaluates automatically
```

---

## Circuit Breakers

| Trigger | Threshold | Action |
|---------|-----------|--------|
| Same error | 3x consecutive | Pause, request help |
| Same file edits | 5x in one iteration | Pause, likely thrashing |
| Budget exceeded | $25 default | Pause, offer continue |
| Iteration limit | 10 default | Pause, offer continue |
| No progress | 3 iterations | Pause, reassess approach |

---

## Commands

| Command | Effect |
|---------|--------|
| `/loop [spec]` | Start new loop from spec |
| `/loop:prd [path]` | Execute PRD tasks autonomously |
| `/loop:prd [path] --parallel` | Execute with parallel task support |
| `/loop continue` | Resume paused loop |
| `/loop continue --budget=25` | Add budget and resume |
| `/loop cancel` | Terminate and clean up |
| `/loop status` | Show current state |

### PRD Mode

Execute tasks from a product PRD with dependency ordering and parallel execution.

```
/loop:prd ./tasks/feature-prd.md --parallel
```

**Features:**
- Parses task blocks from PRD markdown
- Respects `blockedBy` dependencies
- Parallel execution for independent tasks (via Task tool subagents)
- Auto-verifies acceptance criteria

See `references/prd-mode.md` for full documentation.

---

## Cost Controls

| Protection | Default | Max | Override |
|------------|---------|-----|----------|
| Budget cap | $25 | $100 | `--budget=N` |
| Iterations | 10 | 50 | `--iterations=N` |

**Principle:** Pause, don't kill. User can always continue.

---

## Example

User: "loop - refactor all API routes to use validation middleware"

```
[LOOP] Starting | Shape: Colleague (7/10) | Steps: 4 | Budget: $25

Spec scoring:
- Outcome: 2 (clear refactor)
- Scope: 2 (API routes)
- Constraints: 1 (middleware implied)
- Success: 1 (implicit: works)
- Done: 1 (implicit: all routes)
Total: 7/10 → Colleague-shaped

[LOOP] Iteration 1/10 | Cost: $0.50/$25 | Step: Refactor /api/users
... work happens ...
[LOOP] ✓ /api/users complete | Progress: 1/4 | Next: /api/auth

Continue? [Y/n]
```

On completion:
```
<loop-complete>
All success criteria satisfied:
- /api/users refactored: ✓
- /api/auth refactored: ✓
- /api/products refactored: ✓
- /api/orders refactored: ✓
- All tests pass: ✓
</loop-complete>
```

---

## References

- `references/loop-mechanics.md` — Tasks API details, stop_hook_active handling
- `references/prd-mode.md` — PRD execution with dependencies and parallel tasks
- `references/spec-rubric.md` — Scoring examples
- `references/cost-controls.md` — Override syntax, continuation
- `references/headless.md` — CI/CD integration
