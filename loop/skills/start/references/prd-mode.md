# PRD Execution Mode

Execute pre-decomposed tasks from a PRD with boolean acceptance criteria.

## When to Use

| Situation | Mode |
|-----------|------|
| Vague spec, needs decomposition | `/loop [spec]` (standard) |
| Pre-written PRD with 8-15 tasks | `/loop:prd [path]` |
| Multi-story feature (N>5 stories) | Consider `moo-ralph.sh` |

## Command

```
/loop:prd [path-to-prd.md]
```

## Flags

| Flag | Default | Purpose |
|------|---------|---------|
| `--parallel` | false | Enable parallel for tasks marked `parallel: true` |
| `--max-parallel=N` | 3 | Max simultaneous subagents |
| `--budget=N` | 25 | Cost limit in dollars |
| `--strict` | false | Exit on first task failure |

---

## PRD Task Format

Each task in the PRD must follow this format:

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

### Field Descriptions

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique task identifier (T-NNN) |
| `blockedBy` | Yes | Array of task IDs that must complete first |
| `parallel` | No | True if this task can run in parallel with others |

---

## Acceptance Criteria Rules

All criteria must be **machine-verifiable**:

| Good | Bad |
|------|-----|
| "Run `npm test` → exits code 0" | "Tests pass" |
| "POST `/api/user` returns 201" | "API works" |
| "File `config.ts` contains `apiUrl`" | "Config is set up" |

See [testing-patterns.md](../../../product/skills/product/references/testing-patterns.md) for patterns.

---

## Execution Flow

```
1. Parse PRD markdown
2. Extract tasks with metadata
3. Build dependency graph
4. For each task (respecting dependencies):
   a. If blockedBy tasks incomplete → wait
   b. If parallel=true and --parallel → spawn subagent
   c. Execute task
   d. Verify all acceptance criteria
   e. Mark task complete in state
5. On all tasks complete → output <loop-complete>
```

---

## Parallel Execution

When `--parallel` is enabled:

1. **Identify candidates:** Tasks with `parallel: true` and no unmet `blockedBy`
2. **Respect limit:** Max `--max-parallel` concurrent tasks (default 3)
3. **Spawn subagents:** Each parallel task runs in its own agent
4. **Wait for completion:** Continue only when all parallel tasks done
5. **Aggregate results:** Combine verification results into main state

**Cost warning:** Parallel execution multiplies API costs.

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

## State File Extension

PRD mode extends the standard state schema:

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
    },
    "T-002": {
      "status": "in_progress",
      "criteria": {}
    }
  },
  "parallelActive": ["T-003", "T-004"]
}
```

---

## Example PRD

```markdown
# Feature: User Settings Page

## Tasks

### T-001: Add settings route

<!-- task
id: T-001
blockedBy: []
parallel: false
-->

**Acceptance Criteria:**
- [ ] File `src/routes/settings.tsx` exists
- [ ] Route `/settings` renders without error
- [ ] Run `npm test -- settings` → exits code 0

### T-002: Create settings form component

<!-- task
id: T-002
blockedBy: [T-001]
parallel: false
-->

**Acceptance Criteria:**
- [ ] Component `SettingsForm` exported from `src/components/`
- [ ] Form has email and name inputs
- [ ] Form validates required fields

### T-003: Add settings API endpoint

<!-- task
id: T-003
blockedBy: []
parallel: true
-->

**Acceptance Criteria:**
- [ ] GET `/api/settings` returns 200 with user settings
- [ ] PUT `/api/settings` updates and returns 200
- [ ] Unauthorized request returns 401

### T-004: Connect form to API

<!-- task
id: T-004
blockedBy: [T-002, T-003]
parallel: false
-->

**Acceptance Criteria:**
- [ ] Form loads current settings from API
- [ ] Form submit calls PUT endpoint
- [ ] Success shows toast notification
```

---

## When NOT to Use /loop:prd

| Situation | Why Not | Alternative |
|-----------|---------|-------------|
| Exploration/spike | Tasks unknown | `/loop` with vague spec |
| Debug/fix | Single problem | `/loop` standard |
| < 5 tasks | Overhead not worth it | `/loop` standard |
| Tasks need human judgment | Can't verify automatically | Manual iteration |

---

## Troubleshooting

### Tasks not parsing

**Cause:** Malformed HTML comment or missing required fields.

**Fix:** Validate each task has `id` and `blockedBy` in the HTML comment block.

### Dependency cycle

**Cause:** T-001 blockedBy T-002, T-002 blockedBy T-001.

**Fix:** Review task order, remove circular dependency.

### Parallel tasks failing

**Cause:** Shared state mutations, race conditions.

**Fix:** Ensure parallel tasks are truly independent (no shared files/state).
