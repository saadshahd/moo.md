# PRD Mode

Execute tasks from a PRD file autonomously with dependency ordering and parallel execution.

---

## Usage

```
/loop:prd [path-to-prd.md]
```

Or with options:

```
/loop:prd ./tasks/feature-prd.md --parallel --budget=50
```

---

## How It Works

### 1. Parse PRD

Extract tasks from PRD markdown:

```markdown
### T-001: Create user schema
<!-- task
id: T-001
blockedBy: []
parallel: false
-->
```

Regex pattern:
```
/### (T-\d+): (.+)\n<!-- task\nid: (T-\d+)\nblockedBy: \[(.*?)\]\nparallel: (true|false)\n-->/g
```

### 2. Build Dependency Graph

```
T-001 (blockedBy: [])        → Ready
T-002 (blockedBy: [])        → Ready
T-003 (blockedBy: [T-001])   → Blocked
T-004 (blockedBy: [T-001, T-002]) → Blocked
```

### 3. Execute with TodoWrite

Convert to TodoWrite format:

```typescript
TodoWrite({
  todos: [
    {
      content: "T-001: Create user schema",
      status: "pending",
      activeForm: "Creating user schema"
    },
    // ... more tasks
  ]
})
```

### 4. Parallel Execution (Optional)

When `--parallel` flag and tasks have `parallel: true`:

1. Identify ready tasks with no blockers
2. If multiple ready + parallel: spawn Task tool subagents
3. Each subagent executes ONE task
4. Main agent waits for completion
5. Update TodoWrite, unblock dependents
6. Repeat

**Limit:** Max 3 parallel subagents (cost control)

---

## State Management

### State File: `.loop/prd-state.json`

```json
{
  "prdPath": "./tasks/feature-prd.md",
  "tasks": [
    {
      "id": "T-001",
      "content": "Create user schema",
      "blockedBy": [],
      "parallel": false,
      "status": "completed",
      "acceptance": [
        {"criterion": "File `schema.prisma` contains `model User`", "passed": true},
        {"criterion": "`npx prisma validate` exits 0", "passed": true}
      ]
    }
  ],
  "iteration": 3,
  "parallelActive": 0
}
```

### Criteria Extraction

Parse acceptance criteria from PRD:

```markdown
**Acceptance Criteria:**
- [ ] File `schema.prisma` contains `model User`
- [ ] `npx prisma validate` exits 0
```

Becomes:

```json
"acceptance": [
  {"criterion": "File `schema.prisma` contains `model User`", "passed": false},
  {"criterion": "`npx prisma validate` exits 0", "passed": false}
]
```

---

## Iteration Protocol

```
1. Read `.loop/prd-state.json`
2. Find next ready task (status: pending, blockedBy all completed)
3. If multiple ready + parallel flag:
   a. Spawn Task tool subagents (max 3)
   b. Wait for completion
4. Else: Execute single task
5. Verify acceptance criteria
6. Update state file
7. Mark task completed in TodoWrite
8. Check: all tasks done? Output <loop-complete>
9. Else: continue
```

---

## Acceptance Verification

For each criterion, determine verification method:

| Pattern | Verification |
|---------|--------------|
| "File `X` contains `Y`" | `grep -q "Y" X && echo pass` |
| "`cmd` exits 0" | `cmd && echo pass` |
| "[METHOD] `url` returns N" | `curl -s -o /dev/null -w "%{http_code}" url` |
| "Navigate to `url` - X visible" | Requires browser automation |

**Auto-verify:** Command and file patterns
**Manual flag:** Browser patterns (pause for human verification or use agent-browser)

---

## Example Session

```
User: /loop:prd ./prd/auth-feature.md --parallel

[LOOP:PRD] Parsing ./prd/auth-feature.md
Found 8 tasks:
  T-001: Investigate auth config (ready, parallel)
  T-002: Investigate middleware (ready, parallel)
  T-003: Create user schema (ready)
  T-004: Add signup endpoint (blocked by T-003)
  T-005: Add login endpoint (blocked by T-003)
  T-006: Implement auth fix (blocked by T-001, T-002)
  T-007: Add UI components (blocked by T-004, T-005)
  T-008: Verify in browser (blocked by T-007)

[LOOP:PRD] Starting | Tasks: 8 | Parallel: enabled | Budget: $25

[LOOP:PRD] Parallel batch 1: T-001, T-002 (spawning 2 subagents)
  → Subagent 1: Investigating auth config...
  → Subagent 2: Investigating middleware...

[LOOP:PRD] T-001 ✓ | T-002 ✓ | Unblocked: T-006

[LOOP:PRD] Iteration 2 | Executing T-003: Create user schema
... work happens ...
[LOOP:PRD] T-003 ✓ | Unblocked: T-004, T-005

[LOOP:PRD] Parallel batch 2: T-004, T-005, T-006 (spawning 3 subagents)
...

<loop-complete>
All tasks completed:
- T-001: ✓
- T-002: ✓
- T-003: ✓
- T-004: ✓
- T-005: ✓
- T-006: ✓
- T-007: ✓
- T-008: ✓
</loop-complete>
```

---

## Flags

| Flag | Default | Purpose |
|------|---------|---------|
| `--parallel` | false | Enable parallel execution for tasks marked `parallel: true` |
| `--budget=N` | 25 | Cost limit in dollars |
| `--max-parallel=N` | 3 | Max simultaneous subagents |
| `--dry-run` | false | Parse and show plan without executing |

---

## Error Handling

### Task Failure

If acceptance criteria fail after 3 attempts:
1. Mark task as `failed`
2. Pause loop
3. Report which criteria failed
4. Offer: retry, skip, or abort

### Dependency Deadlock

If circular dependencies detected during parse:
1. Abort before execution
2. Report cycle: T-001 → T-002 → T-001
3. User must fix PRD

### Subagent Timeout

If parallel subagent doesn't complete in 10 minutes:
1. Mark as timed out
2. Retry in main agent (not parallel)
3. If still fails: pause and report

---

## Integration with Product Plugin

The `product:prd` workflow generates PRDs with loop-compatible task format.

**Workflow:**

```
1. /product:prd            → Generate PRD with tasks
2. Review and adjust       → Human validates
3. /loop:prd ./output.md   → Execute autonomously
4. Human reviews PR        → Final approval
```

This enables: **Claude works autonomously while you review PRs.**
