# Loop Mechanics

## Architecture Overview

```
User Request
    ↓
┌─────────────────────────────────────────┐
│         STATE DETECTION (Step 0)        │
│  Check .loop/workflow-state.json        │
│  Check TaskList for active tasks        │
│  Offer: Resume / Start fresh / Status   │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│        RECALL LEARNINGS (Step 0.5)      │
│  Surface past failures and discoveries  │
│  User confirms or dismisses             │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│     SPEC SCORING + FIT (Step 1)         │
│  Score request on 5 dimensions          │
│  Calculate fit_score for shape          │
│  <5 → auto-invoke hope:intent           │
│  ≥5 → proceed to shape                  │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│       SHAPE GENERATION (Step 2)         │
│  Auto-invoke hope:shape                 │
│  Extract criteria, mustNot, verification│
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│        DECOMPOSITION (Step 3)           │
│  Parse into atomic tasks (TaskCreate)   │
│  Set dependencies (TaskUpdate blockedBy)│
│  Group into waves                       │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│      WAVE EXECUTION (Step 4)            │
│  Spawn parallel subagents per wave      │
│  Each: execute → verify → report        │
│  Light expert review after each wave    │
│  Stuck 1x → counsel:panel               │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│    THOROUGH REVIEW (Step 5)             │
│  Full expert panel review               │
│  Interactive blocker resolution         │
│  Loop back if blockers remain           │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│        COMPLETION (Step 6)              │
│  Thorough review passed → hope:gate     │
│  Emit <loop-complete>                   │
└─────────────────────────────────────────┘
```

## State Management

### Workflow State (Cross-Session)

`.loop/workflow-state.json` persists workflow progress across sessions:

```json
{
  "version": 1,
  "stage": "intent|shape|decompose|executing|review|complete",
  "task": "original user request",
  "spec_score": 7,
  "fit_score": 35,
  "shape_chosen": "colleague|tool-review|tool",
  "started_at": "2026-02-05T10:00:00Z",
  "last_updated": "2026-02-05T10:15:00Z",
  "recall_surfaced": ["auth edge cases", "validation patterns"],
  "reviews": {
    "wave_1": { "score": 8, "issues": 2, "blockers": 0 },
    "wave_2": { "score": 7, "issues": 3, "blockers": 1 },
    "thorough": { "passed": false, "blockers_remaining": 1 }
  }
}
```

**Stage transitions update the file:**
- intent → shape → decompose → executing → review → complete

**Resume logic:**
1. On `/loop:start`, check for workflow-state.json
2. If exists and stage != complete, offer resume
3. On resume, skip to current stage
4. On "start fresh", delete `.loop/` directory

### Fit Score Calculation

```
fit_score = spec_score × 5  (base: 0-50)
         + (has_constraints ? 5 : 0)
         + (has_success_criteria ? 5 : 0)
         + (has_done_definition ? 5 : 0)
         + (domain_familiarity ? 0-10 : 0)
```

**Shape decision:**
- 40+: Tool-shaped (autonomous)
- 30-39: Tool-with-review (checkpoints)
- 25-29: Colleague-shaped (iterate each step)
- <25: BLOCKED (clarify first)

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

## Stop Hook

The stop hook reads from stdin and checks TaskList state.

### Stop Decision Logic

```
1. Read JSON from stdin
2. If stop_hook_active → {ok: true}
3. If TaskList ID set:
   - Check task files for pending/in_progress
   - None pending → {ok: true}
   - Tasks pending → {ok: false, reason: "pending tasks: ..."}
4. No task list → {ok: true}
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
# Check .loop/workflow-state.json
# Check TaskList files
# Announce resume if loop in progress
```

Resume announcement:
```
[LOOP RESUME] Active loop detected
Stage: {stage} | Spec: {spec_score}/10 | Fit: {fit_score}
Progress: N/M tasks | Wave: X
Reviews: {wave_reviews_summary}
Next: {suggested_action}
```

### Resume Protocol

1. On session start, check `.loop/workflow-state.json`
2. If exists and stage != "complete":
   - Read current stage, scores, review state
   - Offer: "Resume loop? [Y/n/status]"
3. On resume:
   - Skip to current stage (no re-execution of completed stages)
   - Read persisted spec_score and fit_score (don't recalculate)
   - Continue from last wave or review state

### Stage-Specific Resume

| Stage | Resume Action |
|-------|---------------|
| intent | Read spec_score, continue to shape |
| shape | Read SHAPE.md, continue to decompose |
| decompose | Continue creating tasks |
| executing | Read TaskList, continue waves |
| review | Load review state, continue resolution |
| complete | Offer new loop |

## Expert Review Stage

After all tasks complete, before gate:

### Light Review (Per Wave)

Non-blocking expert feedback after each wave:
- Select 2-3 experts based on task aspects
- Quick check: idiomaticity, cleanliness, delivery alignment
- Output score + issues (informational)
- Persist to workflow-state.json

### Thorough Review (Before Gate)

Blocking expert review before completion:
- Full expert panel (3-4 experts)
- Interactive resolution for each finding
- Severity levels: BLOCKER / WARNING / SUGGESTION
- Constraint-aware guidance (checks mustNot from SHAPE.md)
- Creates remediation tasks for unresolved blockers
- Must pass (blockers_remaining = 0) before gate

See [expert-review.md](expert-review.md) for full protocol.

## Completion

Prerequisites: All tasks complete + thorough review passed.

1. Check `reviews.thorough.passed` in workflow-state.json
2. If false → return to review stage
3. If true → invoke `hope:gate` for verification
4. If gate passes → emit `<loop-complete>`
5. If gate fails → create remediation tasks, continue loop

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
