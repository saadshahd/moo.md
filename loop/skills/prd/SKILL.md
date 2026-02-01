---
name: prd
description: Execute pre-decomposed PRD with machine-verifiable tasks. Triggers on "loop prd", "run prd", "execute tasks from PRD", "prd execution". Parses task blocks with T-NNN format, respects dependencies, supports parallel execution with --parallel flag.
---

# PRD Execution

Execute pre-decomposed tasks from a PRD with boolean acceptance criteria.

## When to Use

| Situation | Mode |
|-----------|------|
| Vague spec, needs decomposition | `/loop:start` |
| **Pre-written PRD with 8-15 tasks** | **`/loop:prd`** |
| Multi-story feature (N>5 stories) | Consider `moo-ralph.sh` |

**Do NOT use when:**
- Tasks require human judgment (use manual iteration)
- < 5 tasks (overhead not worth it, use `/loop:start`)
- Exploration/spike work (tasks unknown)
- Single bug fix (use `/loop:start`)

---

## Command

```
/loop:prd [path-to-prd.md]
```

Defaults to `./PRD.md` if no path provided.

## Flags

| Flag | Default | Purpose |
|------|---------|---------|
| `--parallel` | false | Enable parallel for tasks marked `parallel: true` |
| `--max-parallel=N` | 3 | Max simultaneous subagents |
| `--budget=N` | 25 | Cost limit in dollars |
| `--strict` | false | Exit on first task failure |

---

## Protocol

### 1. Parse PRD

Extract tasks matching this format:

```markdown
### T-001: [Action verb] [target]

<!-- task
id: T-001
blockedBy: []
parallel: false
-->

**Acceptance Criteria:**
- [ ] [Boolean criterion 1]
- [ ] [Boolean criterion 2]
```

### 2. Build Dependency Graph

```
T-001 (no blockers) ──┐
                      ├──► T-003
T-002 (no blockers) ──┘
                           │
                           ▼
                        T-004
```

### 3. Execute Tasks

For each task (respecting dependencies):

1. Check `blockedBy` tasks complete
2. If `parallel: true` and `--parallel` flag → spawn subagent
3. Execute task
4. Verify ALL acceptance criteria
5. Update state with verification types
6. Mark task complete

### 4. State Tracking

Write `.loop/state.json` with PRD extension:

```json
{
  "mode": "prd",
  "prdPath": "./feature-prd.md",
  "tasks": {
    "T-001": {
      "status": "completed",
      "criteria": {
        "npm test exits 0": {"met": true, "verification": "execution output"}
      }
    }
  },
  "parallelActive": []
}
```

### 5. Completion

When all tasks complete:

```
<loop-complete>
All tasks complete:
- T-001: Add settings route ✓
- T-002: Create form component ✓
- T-003: Add API endpoint ✓
</loop-complete>
```

Include quality footer with verification summary.

---

## Task Format Reference

See [prd-mode.md](../start/references/prd-mode.md) for:
- Full task format specification
- Parallel execution details
- Example PRD with 8+ tasks

See [testing-patterns.md](../../../product/skills/product/references/testing-patterns.md) for:
- Machine-verifiable criteria patterns
- Verification type mapping

---

## Difference from /loop:start

| Aspect | /loop:start | /loop:prd |
|--------|-------------|-----------|
| Input | Vague or moderate spec | Structured PRD |
| Decomposition | Claude in-loop | Human pre-decomposed |
| Criteria | Mixed verifiable/judgment | 100% machine-verifiable |
| Parallelization | N/A | Built-in (max 3) |
| Task format | Free-form steps | Strict T-NNN format |
| Dependencies | Implicit | Explicit `blockedBy` |

---

## Example

```
/loop:prd ./features/user-settings-prd.md --parallel --budget=50
```

Executes all tasks in the PRD, running parallel-eligible tasks concurrently, with $50 budget cap.
