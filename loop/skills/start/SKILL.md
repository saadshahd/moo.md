---
name: start
description: Start autonomous iteration loop OR explain how Loop works. Triggers on "loop", "keep going", "don't stop", "continue until done", "until tests pass", "implement full feature", "fix all problems", "make better", "what is loop", "how does loop work", "loop help", or any persistence pattern. Executes multi-step tasks without stopping until complete or limits reached.
model: opus
allowed-tools: Bash, Read, Task, TaskCreate, TaskUpdate, TaskList, TaskGet, Skill, AskUserQuestion
---

# Loop

Autonomous iteration with wave-based parallel execution. Continues until spec is satisfied or limits reached.

## Architecture

```
User Request
    ↓
[SPEC SCORING] → <5? auto-invoke hope:intent
    ↓
[SHAPE GENERATION] → auto-invoke hope:shape
    ↓
[DECOMPOSITION] → atomic tasks via TaskCreate
    ↓
[WAVE EXECUTION] → parallel subagents per wave
    ↓
[COMPLETION] → hope:gate verification
```

---

## Step 0: User Configuration

Before starting, ask user to configure the loop:

```
AskUserQuestion:
  1. "How should this loop track tasks?"
     - "New task list (project-based)" → Fresh start with '{project-name}-loop' ID
     - "Resume existing" → Continue from existing task list
     - "Session-only" → No persistence

  2. "Max iterations before pausing?"
     - "10 iterations (quick task)"
     - "25 iterations (medium feature)"
     - "50 iterations (large refactor)"
     - "Unlimited (manual stop only)"

  3. "Budget limit?"
     - "$10 (conservative)"
     - "$25 (default)"
     - "$50 (large task)"
     - "No limit"
```

Set `CLAUDE_CODE_TASK_LIST_ID` based on choice.

---

## Step 1: Spec Scoring

Score the user request on 5 dimensions (0-2 each, max 10):

| Dimension | 0 | 1 | 2 |
|-----------|---|---|---|
| **Outcome** | "Make it better" | "Improve performance" | "p95 latency <100ms" |
| **Scope** | "Fix the app" | "Fix auth" | "Fix /api/auth/token" |
| **Constraints** | None stated | "Use existing stack" | "No new deps, <500 LOC" |
| **Success** | None stated | "Tests pass" | "All tests + manual QA" |
| **Done** | Implied | "When it works" | "PR merged to main" |

**Decision:**
- **≥8:** Tool-shaped — proceed directly to decomposition
- **5-7:** Colleague-shaped — confirm approach after decomposition
- **<5:** Run `Skill(skill="hope:intent", args="$ARGUMENTS")` first

---

## Step 1.5: Expert-Driven Clarification (if score <5)

For each dimension scoring <2, invoke counsel:panel to generate expert-informed options.

### Dimension → Expert Panel Mapping

| Dimension | Experts | Focus |
|-----------|---------|-------|
| **Outcome** | Jobs, Graham, Kay, Victor | Vision, impact, what "done" looks like |
| **Scope** | Fowler, Hickey, Feathers, Alexander | Boundaries, simplicity, patterns |
| **Constraints** | Pike, Osmani, Hightower, Gregg | Engineering limits, performance, ops |
| **Success** | Norman, Majors, Zhuo, Beck | Quality, observability, UX, testing |
| **Done** | Cagan, Humble, Newman | Delivery, release criteria, ship gates |

### Extended Aspects

| Aspect | Experts |
|--------|---------|
| **Design** | Norman, Zhuo, Frost, Alexander |
| **UI** | Abramov, Osmani, Perry, Wathan |
| **UX** | Norman, Zhuo, Victor, Case |
| **Innovation** | Jobs, Kay, Victor, Matuschak |

### Protocol

1. **Identify unclear dimensions** — Which scored 0 or 1?

2. **For each unclear dimension:**
   ```
   Skill(skill="counsel:panel", args="clarify {dimension} for: {spec}")
   ```
   Panel returns 3-4 expert-recommended approaches.

3. **Present options:**
   ```
   AskUserQuestion:
     question: "How would you describe the {dimension}?"
     options:
       - Expert A's recommendation (with reasoning)
       - Expert B's recommendation (with reasoning)
       - Expert C's recommendation (with reasoning)
   ```
   User can select an expert option or provide custom input via "Other".

4. **Apply selection** — Update spec with clarified dimension

5. **Re-score** — After all dimensions clarified, re-score spec

### Example: Unclear Outcome

For "loop - make auth better":
- Outcome scores 0 ("make better" is vague)

Panel invocation:
```
counsel:panel "clarify outcome for: make auth better"
```

Panel response:
- Jobs-perspective: "Users complete login 50% faster"
- Graham-perspective: "Reduce code complexity, easier to modify"
- Kay-perspective: "Auth becomes composable building block"

AskUserQuestion:
```
question: "What outcome do you want for auth?"
options:
  - "Users complete login faster" (Jobs: user-centric)
  - "Simpler code, easier to change" (Graham: pragmatic)
  - "Composable auth system" (Kay: systemic)
```

User selects → Outcome now scores 2.

---

## Step 2: Shape Generation (if score ≥5)

Invoke shape skill to get implementation approach:

```
Skill(skill="hope:shape", args="$ARGUMENTS")
```

Extract from SHAPE.md output:
- **criteria[]** → Success criteria for completion
- **mustNot[]** → Circuit breaker conditions
- **verification{}** → How to verify each criterion

---

## Step 3: Task Decomposition

Break work into atomic tasks using the "one sentence without and" test.

See [decomposition.md](references/decomposition.md) for details.

**For each atomic unit:**
```
TaskCreate(
  subject="[imperative action]",
  description="[detailed what + acceptance criteria + verify command]",
  activeForm="[present continuous for spinner]"
)
```

**Set dependencies:**
```
TaskUpdate(taskId="4", addBlockedBy=["1", "3"])
```

**Announce:**
```
[LOOP] Starting | Shape: {Tool/Colleague} ({score}/10) | Tasks: {N} | Budget: ${budget}
```

---

## Step 4: Wave Execution

A **wave** is tasks with no blockedBy dependencies or all blockedBy tasks completed.

### Wave Detection

```
1. TaskList() → Get all tasks
2. Filter: status="pending" AND blockedBy is empty or all complete
3. Current wave = matching tasks
```

### Execute Wave

For each task in wave:

1. `TaskUpdate(taskId, status="in_progress")`

2. Spawn parallel subagents (all Task calls in single message):
```
Task(prompt="Execute: {subject}. {description}", subagent_type="general-purpose")
```

3. Wait for all subagents to complete

4. For each completed:
   - Success → `TaskUpdate(taskId, status="completed")`
   - Failed → Increment stuckCount, check for stuck handling

### Quick Verification After Task

After each task completes, run quick verify:

```
Skill(skill="hope:verify", args="quick")
```

Quick tier (< 5s): fastest discovered check only. If fails:
- Don't mark task complete
- Escalate to standard tier for diagnostics
- Fix issue before proceeding

### Stuck Handling

When task fails (verification command doesn't pass):

```
IF stuckCount >= 1:
  Announce: "[LOOP] Task {id} stuck. Consulting expert panel..."
  Skill(skill="counsel:panel", args="stuck on {subject}: {error}")
  Apply recommendation from panel
  Retry with new approach
```

Pauses only at max iterations (no mid-loop human escalation).

### Progress Update

After each wave, update `.loop/PROGRESS.md`:

```markdown
# Loop Progress: {goal}

**Status:** Wave {N} | Iteration {i} | Cost: ${spent}/${budget}

## ✅ Completed
- [x] T-001: {subject}

## 🔄 In Progress
- [ ] T-002: {subject}

## ⏳ Pending
- [ ] T-003: {subject} (blocked by T-002)
```

### Iteration Announcement

Before each wave:
```
[LOOP] Wave {N} | Iteration {i}/{max} | Cost: ${X}/${budget} | Tasks: {executing}
```

After each wave:
```
[LOOP] ✓ Wave {N} complete | Progress: {completed}/{total} | Next: {next_wave_tasks}
```

---

## Step 5: Completion

When all tasks have status="completed":

1. Run thorough verification:
```
Skill(skill="hope:verify", args="thorough")
```

Thorough tier (< 2min): all checks + criterion-specific commands + evidence.

2. Invoke verification gate:
```
Skill(skill="hope:gate", args="loop completion verification")
```

3. If gate passes (verify passed), emit completion:
```
<loop-complete>
All tasks verified:
- T-001: ✓ {subject}
- T-002: ✓ {subject}
- T-003: ✓ {subject}

╭─ 🟢 SHIP ──────────────────────────╮
│ Verified: execution output          │
│ Tasks: {N}/{N} complete             │
│ Subjective: ~X% · Type 2B · Npt    │
├────────────────────────────────────┤
│ ↳ Alt: [alternative approach]       │
│ ↳ Risk: [key assumption]            │
╰────────────────────────────────────╯
</loop-complete>
```

3. If gate fails → create remediation tasks, continue loop

---

## Workflow Detection

After spec scoring, detect workflow type:

| Workflow | Indicators | Gate |
|----------|------------|------|
| **A (Build)** | "add", "implement", "create" | Library search required |
| **B (Debug)** | "fix", "debug", "broken", "error" | Root cause before workaround |
| **C (Refactor)** | "refactor", "clean up", "migrate" | Deletion before redesign |

Reference [hope/skills/soul](../../hope/skills/soul/SKILL.md) for workflow details.

---

## Circuit Breakers

| Trigger | Threshold | Action |
|---------|-----------|--------|
| Max iterations reached | User-configured | Pause, announce progress |
| Budget exceeded | User-configured | Pause, offer continue |
| mustNot condition true | From SHAPE.md | Stop immediately, announce |

---

## Commands

| Command | Effect |
|---------|--------|
| `/loop [spec]` | Start new loop |
| `/loop continue` | Resume paused loop |
| `/loop continue --budget=25` | Add budget and resume |
| `/loop cancel` | Terminate and clean up |
| `/loop status` | Show current state from TaskList |

---

## Example

User: "loop - add validation to auth module"

```
[LOOP] Configuring...

Spec scoring:
- Outcome: 1 (add validation - clear but no specifics)
- Scope: 2 (auth module - specific)
- Constraints: 0 (none stated)
- Success: 0 (implicit)
- Done: 0 (implicit)
Total: 3/10 → Intent-shaped

[LOOP] Spec unclear (3/10). Running intent clarification...
→ Invoking /hope:intent

[After intent clarification, spec is now 7/10]

[LOOP] Generating implementation shape...
→ Invoking /hope:shape

[LOOP] Starting | Shape: Colleague (7/10) | Tasks: 6 | Budget: $25

Tasks created:
- T-001: Add ValidationError class to errors.ts
- T-002: Create user validation schema
- T-003: Add validateUser function (blocked by T-001, T-002)
- T-004: Add validateToken function (blocked by T-001)
- T-005: Add tests for validation (blocked by T-003, T-004)
- T-006: Update auth routes to use validation (blocked by T-003, T-004)

[LOOP] Wave 1 | Iteration 1/25 | Cost: $0/$25 | Tasks: T-001, T-002
→ Spawning 2 parallel subagents...

[LOOP] ✓ Wave 1 complete | Progress: 2/6 | Next: T-003, T-004

[LOOP] Wave 2 | Iteration 2/25 | Cost: $1.50/$25 | Tasks: T-003, T-004
→ Spawning 2 parallel subagents...

[LOOP] ✓ Wave 2 complete | Progress: 4/6 | Next: T-005, T-006

[LOOP] Wave 3 | Iteration 3/25 | Cost: $3.00/$25 | Tasks: T-005, T-006
→ Spawning 2 parallel subagents...

[LOOP] ✓ Wave 3 complete | Progress: 6/6 | Next: completion

[LOOP] Running completion gate...

<loop-complete>
All tasks verified:
- T-001: ✓ Add ValidationError class
- T-002: ✓ Create user validation schema
- T-003: ✓ Add validateUser function
- T-004: ✓ Add validateToken function
- T-005: ✓ Add validation tests
- T-006: ✓ Update auth routes

╭─ 🟢 SHIP ──────────────────────────╮
│ Verified: execution output          │
│ Tasks: 6/6 complete                 │
│ Subjective: ~90% · Type 2B · 5pt   │
├────────────────────────────────────┤
│ ↳ Alt: Manual integration testing   │
│ ↳ Risk: Edge cases in schema        │
╰────────────────────────────────────╯
</loop-complete>
```

---

## References

- [decomposition.md](references/decomposition.md) — Atomic task format, "one sentence" test
- [waves.md](references/waves.md) — Wave execution protocol, parallel subagents
- [loop-mechanics.md](references/loop-mechanics.md) — State management, stop hook, completion

---

## Boundary

**Loop executes, never decides.**

- User controls what gets built — loop executes the spec, doesn't expand it
- User controls persistence — state disclosed, cleanup offered
- User controls continuation — pause is always honored, "cancel" is immediate

Loop advises when patterns emerge. If same task pattern repeats 3+ times:
> "This is a repeating pattern. Want the steps to run yourself?"
