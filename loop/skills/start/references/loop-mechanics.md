# Loop Mechanics

## Architecture Overview

```
User Request
    ↓
┌─────────────────────────────────────────┐
│            SPEC SCORING                 │
│  Score request on 5 dimensions          │
│  <5 → auto-invoke hope:intent           │
│  ≥5 → proceed to shape                  │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│          SHAPE GENERATION               │
│  Auto-invoke hope:shape                 │
│  Extract criteria, mustNot, verification│
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│            DECOMPOSITION                │
│  Parse into atomic tasks (TaskCreate)   │
│  Set dependencies (TaskUpdate blockedBy)│
│  Group into waves                       │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│          WAVE EXECUTION                 │
│  Spawn parallel subagents per wave      │
│  Each: execute → verify → report        │
│  Stuck 1x → counsel:panel               │
│  Continue until done or max iterations  │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│           COMPLETION                    │
│  All tasks verified → hope:gate         │
│  Emit <loop-complete>                   │
└─────────────────────────────────────────┘
```

## State Management

### Primary: TaskList API

Claude Code's TaskList is the source of truth for task state.

**Task creation:**
```
TaskCreate(
  subject="Add ValidationError import",
  description="Add import to src/auth.ts. Verify: grep 'ValidationError' src/auth.ts",
  activeForm="Adding import"
)
```

**Task metadata:**
```
TaskUpdate(taskId="1", metadata={
  "wave": 1,
  "loopId": "auth-validation",
  "verification": "execution output",
  "stuckCount": 0
})
```

**Dependencies:**
```
TaskUpdate(taskId="4", addBlockedBy=["1", "3"])
```

### Persistence

Tasks persist to disk at: `~/.claude/tasks/{CLAUDE_CODE_TASK_LIST_ID}/`

```
~/.claude/tasks/my-loop/
├── .highwatermark    # Highest task ID
├── .lock             # Concurrency lock
├── 1.json            # Task 1
├── 2.json            # Task 2
└── ...
```

**Persistence verified across:**
- Context compaction ✓
- Session clear (`/clear`) ✓
- New session (restart CLI) ✓
- Across days ✓

### Secondary: PROGRESS.md

Human-readable progress file in `.loop/PROGRESS.md`:

```markdown
# Loop Progress: Add validation to auth

**Status:** Wave 2 of 4 | Iteration 3 | Cost: $2.50/$25

## ✅ Completed (Wave 1)
- [x] T-001: Add ValidationError import to auth.ts
- [x] T-002: Add ValidationError import to api.ts

## 🔄 In Progress (Wave 2)
- [ ] T-003: Create validation schema (assigned to subagent)
- [ ] T-004: Implement validateToken

## ⏳ Pending (Wave 3+)
- [ ] T-005: Implement validateUser (blocked by T-003)

## 📊 Metrics
- Tasks: 2/6 complete
- Stuck count: 0
- Counsel consulted: No
```

### Legacy: .loop/state.json

For backward compatibility, the stop hook also checks `.loop/state.json`:

```json
{
  "spec": "original user request",
  "criteria": ["tests pass", "lint clean"],
  "criteriaStatus": {
    "tests pass": {"met": false, "verification": "assumption"},
    "lint clean": {"met": true, "verification": "execution output"}
  },
  "exit_signal": false,
  "status": "in_progress",
  "circuitBreaker": {
    "stuckCount": 0,
    "lastUnmet": "tests pass"
  }
}
```

## Stop Hook

The stop hook reads from stdin (not environment variables) and checks:

1. **stop_hook_active** → If true, allow stop (prevents infinite loops)
2. **TaskList** → If CLAUDE_CODE_TASK_LIST_ID set, check task files
3. **state.json** → Fall back to legacy state file

### Stop Decision Logic

```
1. Read JSON from stdin
2. If stop_hook_active → {ok: true}
3. If TaskList ID set:
   - Check task files for pending/in_progress
   - None pending → {ok: true}
   - Tasks pending → {ok: false, reason: "pending tasks: ..."}
4. If state.json exists:
   - status = completed/cancelled → {ok: true}
   - stuckCount >= 5 → {ok: true}
   - ALL criteria true AND exit_signal true → {ok: true}
   - Otherwise → {ok: false, reason: "..."}
5. No state → {ok: true}
```

## Self-Unblocking

When stuck (task fails verification):

1. **First failure** → Increment stuckCount in task metadata
2. **stuckCount >= 1** → Immediately invoke `/counsel:panel`
3. **Apply recommendation** → Update approach based on expert consensus
4. **Retry** → Execute with new approach
5. **Only pause** → At max iterations (user-configurable)

**No human escalation during loop.** Users configure max iterations at loop start.

## Wave Execution Protocol

```
1. TaskList() → Get all tasks
2. Filter: status="pending" AND blockedBy empty → Wave N
3. For each task in wave:
   - TaskUpdate(status="in_progress")
   - Spawn subagent: Task(prompt="...", subagent_type="general-purpose")
4. Wait for all subagents
5. For each completed:
   - Success → TaskUpdate(status="completed")
   - Failure → Increment stuckCount, invoke counsel if ≥1
6. Update PROGRESS.md
7. Repeat until no pending tasks
```

## User Configuration

At loop start, AskUserQuestion configures:

1. **Task list mode:**
   - New (project-based ID)
   - Resume existing
   - Session-only (no persistence)

2. **Max iterations:**
   - 10 (quick task)
   - 25 (medium feature)
   - 50 (large refactor)
   - Unlimited

3. **Budget limit:**
   - $10, $25, $50, or no limit

## Session Resume

SessionStart hook checks for active loops:

```bash
# session-resume.sh
# Check TaskList files and .loop/state.json
# Announce resume if loop in progress
```

Resume announcement:
```
[LOOP RESUME] Active loop detected
Spec: {summary}
Progress: N/M tasks | Wave: X
Next: {first pending task}
```

## Completion

When all tasks complete:

1. Invoke `hope:gate` for verification
2. If gate passes → emit `<loop-complete>`
3. If gate fails → create remediation tasks, continue loop

```
<loop-complete>
All tasks verified:
- T-001: ✓ Add ValidationError import
- T-002: ✓ Create validation schema
- T-003: ✓ Implement validateToken
- T-004: ✓ Add tests

╭─ 🟢 SHIP ──────────────────────────╮
│ Verified: execution output          │
│ Tasks: 4/4 complete                 │
│ Subjective: ~90% · Type 2B · 5pt   │
├────────────────────────────────────┤
│ ↳ Alt: Manual verification          │
│ ↳ Risk: Edge cases in validation    │
╰────────────────────────────────────╯
</loop-complete>
```

## Troubleshooting

### Loop stops too early

**Cause:** Stop hook not reading stdin, or tasks not in TaskList.

**Fix:**
1. Verify stop hook reads from `cat` (stdin)
2. Check CLAUDE_CODE_TASK_LIST_ID is set
3. Verify task files exist in ~/.claude/tasks/

### Loop runs forever

**Cause:** Tasks never completing, or dependencies circular.

**Fix:**
1. Check task verification commands
2. Review blockedBy for cycles
3. Check max iterations is set

### Counsel not invoked

**Cause:** stuckCount not incrementing.

**Fix:**
1. Verify task metadata includes stuckCount
2. Check failure detection in subagent response
