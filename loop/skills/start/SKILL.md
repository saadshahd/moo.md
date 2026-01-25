---
name: start
description: Start autonomous iteration loop OR explain how Loop works. Triggers on "loop", "keep going", "don't stop", "continue until done", "until tests pass", "implement full feature", "fix all problems", "make better", "what is loop", "how does loop work", "loop help", or any persistence pattern. Executes multi-step tasks without stopping until complete or limits reached.
---

# Loop

Autonomous iteration that continues until spec is satisfied or limits reached.

## Activation

Score the user's spec against the 5-dimension rubric (see `references/spec-rubric.md`).

**Decision:**
- **Score ≥8:** Proceed autonomously (Tool-shaped)
- **Score 5-7:** Clarify gaps OR proceed as Colleague-shaped (iterate together)
- **Score <5:** Run `/hope:intent` first to clarify requirements

## Workflow Shape

| Shape | When | Behavior |
|-------|------|----------|
| **Tool-shaped** | Clear spec (≥8/10), well-defined success | Execute silently, report on completion |
| **Colleague-shaped** | Ambiguous spec (5-7/10), needs judgment | Check in after each iteration, seek feedback |

## Loop Protocol

### 1. Initialize

```
TaskCreate:
  subject: "Complete: [one-line spec summary]"
  description: Full spec + success criteria
  metadata:
    iteration: 1
    cost: 0
    shape: "tool" | "colleague"
    budget: 25
    maxIterations: 10
```

### 2. Each Iteration

```
TaskGet → Retrieve current state
Execute → Do the work (one logical unit)
TaskUpdate → Increment iteration, accumulate cost
Stop Hook → Evaluate: done? limit hit? blocked?
```

### 3. Termination Conditions

| Condition | Action |
|-----------|--------|
| Spec satisfied | TaskUpdate status=completed, report summary |
| Budget exceeded | Pause, save state, prompt for `/loop continue` |
| Iteration limit | Pause, save state, prompt for continuation |
| Circuit breaker | Pause, explain blocker, request guidance |
| Blocked/confused | Pause, ask clarifying question |

## Stop Hook Evaluation

After each iteration, evaluate:

1. **Progress check:** Did this iteration move toward the spec?
2. **Completion check:** Does current state satisfy all success criteria?
3. **Limit check:** Budget, iterations, circuit breakers
4. **Blocker check:** Stuck? Same error 3x? Same file 5x?

If Tool-shaped and not done → continue silently
If Colleague-shaped → report progress, continue with permission

## Commands

| Command | Effect |
|---------|--------|
| `/loop` | Start new loop |
| `/loop continue` | Resume paused loop |
| `/loop cancel` | Terminate and clean up |
| `/loop status` | Show current iteration, cost, progress |

## Cost Controls

See `references/cost-controls.md` for limits and overrides.

Key principle: **Pause, don't kill.** User can always continue.

## Headless Mode (CI/CD)

See `references/headless.md` for CI/CD integration:
- Environment variables (`LOOP_HEADLESS`, `LOOP_BUDGET`, `LOOP_MAX_ITERATIONS`)
- Exit codes and output artifacts
- GitHub Actions and GitLab CI examples in `ci/`

## Tips

- Clear specs (>=8/10) run faster with less interruption
- Vague specs? Run `/hope:intent` first to clarify requirements
- Pause is not failure — resume anytime with `/loop continue`

## Example

User: "loop - refactor all API routes to use the new validation middleware"

1. Score spec: Outcome=2, Scope=2, Constraints=1, Success=1, Done=1 → **7/10**
2. Shape: Colleague (ambiguous success criteria)
3. TaskCreate with iteration tracking
4. Per route: refactor → test → TaskUpdate
5. After each: "Completed /api/users, /api/auth next. Continue?"
6. On completion: TaskUpdate status=completed, summary report
