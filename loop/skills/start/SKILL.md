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

## State File Schema (CRITICAL)

Write `.loop/state.json` at loop start and update after EVERY iteration:

```json
{
  "spec": "original user request verbatim",
  "criteria": ["tests pass", "all routes refactored", "no lint errors"],
  "criteriaStatus": {
    "tests pass": false,
    "all routes refactored": false,
    "no lint errors": true
  },
  "exit_signal": false,
  "steps": ["step1", "step2", "step3"],
  "completedSteps": ["step1"],
  "remainingSteps": ["step2", "step3"],
  "iteration": 2,
  "status": "in_progress",
  "circuitBreaker": {
    "stuckCount": 0,
    "lastUnmet": "tests pass"
  }
}
```

**The stop hook reads this file to decide whether to continue.**

---

## Dual-Condition Exit (CRITICAL)

The stop hook requires BOTH conditions to stop:

1. **All `criteriaStatus` values are `true`**
2. **`exit_signal` is `true`**

If either condition is false, the loop continues.

### Why Dual-Condition?

Prevents premature stops. Claude must:
1. Actually verify each criterion (tests pass, lint clean, etc.)
2. Explicitly signal completion intent

---

## Iteration Protocol

```
1. TaskGet → Retrieve current state
2. Read .loop/state.json if exists (recovery case)
3. Announce → [LOOP] Iteration N/max | Cost: $X | Step: [name]
4. Execute → Do ONE logical unit of work
5. Verify → Run verification commands for affected criteria
6. Update state → Write .loop/state.json with updated criteriaStatus
7. Check circuit breaker → Increment stuckCount if same criteria unmet
8. Output status block → ---LOOP_STATUS--- (required)
9. TaskUpdate → Save to Tasks API (backup)
```

---

## Status Block (REQUIRED)

After EACH iteration, output this exact format:

```
---LOOP_STATUS---
EXIT_SIGNAL: false
CRITERIA: {"tests pass": false, "lint clean": true}
STUCK_COUNT: 0
NEXT: Fix failing tests
---END_STATUS---
```

**Rules:**
- `EXIT_SIGNAL: true` ONLY when ALL criteria verified true
- `CRITERIA` must match `criteriaStatus` in state file
- `STUCK_COUNT` increments when same criteria remain unmet
- `NEXT` describes the next action

---

## State Update Protocol

After each iteration:

1. **Run verification commands** for criteria you worked on
2. **Update `criteriaStatus`** based on actual verification results
3. **Check for stuck state:**
   - If same criteria unmet as last iteration, increment `circuitBreaker.stuckCount`
   - If different criteria unmet, reset `stuckCount` to 0
4. **Set `exit_signal`:**
   - `true` ONLY if ALL criteriaStatus values are true
   - `false` otherwise
5. **Write updated state** to `.loop/state.json`
6. **Output status block**

---

## Circuit Breakers

| Trigger | Threshold | Action |
|---------|-----------|--------|
| Same criteria unmet | 5x consecutive | Stop hook opens circuit |
| Same error | 3x consecutive | Pause, request help |
| Same file edits | 5x in one iteration | Pause, likely thrashing |
| Budget exceeded | $25 default | Pause, offer continue |
| Iteration limit | 10 default | Pause, offer continue |

The stop hook checks `circuitBreaker.stuckCount >= 5` and returns `{ok: true}` to stop.

---

## Announcements

### Before Each Iteration

```
[LOOP] Iteration N/max | Cost: $X/$budget | Step: [current step]
```

### After Each Iteration

```
[LOOP] ✓ [step name] complete | Progress: N/total | Next: [next step]
```

### On Completion

```
<loop-complete>
All success criteria satisfied:
- [criterion 1]: ✓
- [criterion 2]: ✓
- [criterion 3]: ✓
</loop-complete>
```

Output `<loop-complete>` ONLY after:
1. All criteriaStatus values are true
2. exit_signal set to true in state file

### On Pause

```
[LOOP] ⏸ Paused: [reason]
Progress: N steps complete, M remaining
Resume: /loop continue
```

---

## Commands

| Command | Effect |
|---------|--------|
| `/loop [spec]` | Start new loop |
| `/loop continue` | Resume paused loop |
| `/loop continue --budget=25` | Add budget and resume |
| `/loop cancel` | Terminate and clean up |
| `/loop status` | Show current state |

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

---LOOP_STATUS---
EXIT_SIGNAL: false
CRITERIA: {"/api/users refactored": true, "/api/auth refactored": false, "tests pass": false}
STUCK_COUNT: 0
NEXT: Refactor /api/auth
---END_STATUS---

Continue? [Y/n]
```

On completion:
```
---LOOP_STATUS---
EXIT_SIGNAL: true
CRITERIA: {"/api/users refactored": true, "/api/auth refactored": true, "tests pass": true}
STUCK_COUNT: 0
NEXT: none
---END_STATUS---

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

- `references/loop-mechanics.md` — Command-based stop hook, state schema, circuit breaker
- `references/spec-rubric.md` — Scoring examples
- `references/cost-controls.md` — Override syntax, continuation
- `references/headless.md` — CI/CD integration
