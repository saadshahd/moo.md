# Loop Mechanics

## Dual-State Model

The loop uses **two persistence mechanisms** for robustness:

1. **Tasks API** — Primary state, survives within a session
2. **`.loop/state.json`** — File-based, survives across sessions/compaction

### Why Both?

| Mechanism | Survives Compaction | Stop Hook Readable | Human Inspectable |
|-----------|--------------------|--------------------|-------------------|
| Tasks API | ✗ | ✗ (internal) | ✗ |
| `.loop/state.json` | ✓ | ✓ | ✓ |

The stop hook cannot read Tasks API directly — it can only evaluate the transcript and files. The state file provides criteria information that the stop hook needs to make informed decisions.

### State File Location

Project root: `.loop/state.json`

This follows the "Ralph pattern" — project-local state that can be:
- Committed if desired (add to `.gitignore` to exclude)
- Inspected during debugging
- Resumed after compaction or new session

---

## Stop Hook Behavior

The Stop hook fires after each Claude response. It receives JSON input via `$ARGUMENTS`:

```json
{
  "session_id": "abc123",
  "transcript_path": "~/.claude/projects/.../abc123.jsonl",
  "cwd": "/path/to/project",
  "hook_event_name": "Stop",
  "stop_hook_active": true
}
```

### stop_hook_active Field

**Critical for preventing infinite loops.**

- `stop_hook_active: false` — First evaluation, loop hasn't continued yet
- `stop_hook_active: true` — Already continuing from a previous stop hook

The stop hook prompt checks: "Has stop_hook_active been true for 3+ consecutive evaluations?" to prevent runaway loops.

### Response Schema

The stop hook MUST return JSON only (no explanation, no markdown):

```json
{"ok": true, "reason": "complete"}
```

or

```json
{"ok": false, "reason": "next: [specific action]"}
```

**Exit code 0 required.** Any preamble text causes "JSON validation failed" error.

### Completion Detection

The stop hook uses a **two-phase check**:

**Phase 1: Read state file**
```
.loop/state.json → criteriaStatus object
```

**Phase 2: Evaluate**
```
IF .loop/state.json doesn't exist → {ok: true} (no active loop)
IF ANY criteriaStatus value is false → {ok: false, reason: "unmet: [criteria]"}
IF ALL criteriaStatus values are true AND <loop-complete> present → {ok: true}
```

The `<loop-complete>` marker signals intent, but the state file provides the source of truth for criteria satisfaction.

### State File Schema

```json
{
  "spec": "original user request",
  "criteria": ["test passes", "no lint errors"],
  "criteriaStatus": {
    "test passes": true,
    "no lint errors": false
  },
  "steps": ["step1", "step2"],
  "completedSteps": ["step1"],
  "remainingSteps": ["step2"],
  "iteration": 2,
  "status": "in_progress"
}
```

**Critical:** The `criteriaStatus` object is what the stop hook checks. Update it after each verification.

---

### State Schema

```json
{
  "id": "task-uuid",
  "subject": "Complete: [spec summary]",
  "description": "Full spec with success criteria",
  "status": "in_progress",
  "metadata": {
    "iteration": 3,
    "cost": 4.50,
    "shape": "tool",
    "budget": 25,
    "maxIterations": 10,
    "startedAt": "ISO-timestamp",
    "lastCheckpoint": "ISO-timestamp",
    "completedSteps": ["step1", "step2"],
    "remainingSteps": ["step3", "step4"],
    "errors": []
  }
}
```

### Lifecycle

**Start:**
1. Parse user spec
2. Score against rubric
3. Determine shape (tool/colleague)
4. Decompose into steps if possible
5. TaskCreate with initial metadata

**Iterate:**
1. TaskGet current state
2. Select next step from `remainingSteps`
3. Execute step
4. On success: move step to `completedSteps`
5. On failure: add to `errors`, evaluate circuit breakers
6. TaskUpdate with new metadata
7. Run stop hook evaluation

**Pause:**
1. TaskUpdate with current state preserved
2. Output pause reason and resume command
3. State remains in Tasks API for continuation

**Resume:**
1. TaskGet to restore state
2. Continue from `remainingSteps[0]`
3. Resume iteration loop

**Complete:**
1. Verify all success criteria met
2. TaskUpdate status=completed
3. Output summary report

## Iteration Unit

One iteration = one logical unit of work:
- One file refactored
- One test written
- One bug fixed
- One API endpoint updated

Keep iterations small enough to:
- Track progress granularly
- Pause cleanly at any point
- Report meaningful increments

## Error Handling

| Error Type | Response |
|------------|----------|
| Transient (network, timeout) | Retry once, then pause |
| Logic (test failure, lint) | Attempt fix, count toward circuit breaker |
| Blocking (missing dep, permissions) | Pause immediately, request help |
| Unknown | Pause, preserve state, request guidance |

## Checkpoint Strategy

Update task metadata after every successful iteration:
- Preserves progress on interruption
- Enables accurate cost tracking
- Supports clean resume

---

## Troubleshooting

### "Stop hook error: JSON validation failed"

**Cause:** The LLM response included text before/after the JSON object.

**Fix:** The stop hook prompt ends with "JSON ONLY:" to enforce pure JSON output. If still failing:
1. Check that the prompt hasn't been modified
2. Verify timeout is sufficient (30s default)
3. The LLM (Haiku) may occasionally add preamble — retry typically succeeds

### Loop runs forever

**Cause:** Missing `<loop-complete>` marker or criteriaStatus not being updated.

**Fix:**
1. Ensure you write `.loop/state.json` with `criteriaStatus` after each iteration
2. Verify all criteria are explicitly listed in the `criteria` array
3. Check that `criteriaStatus` values are being updated to `true` when verified
4. Output `<loop-complete>` only when ALL criteriaStatus values are `true`

### Loop stops too early

**Cause:** Stop hook returns `{ok: true}` when no state file exists, or criteriaStatus is missing/malformed.

**Fix:**
1. Ensure `.loop/state.json` is written at loop start
2. Don't output `<loop-complete>` until ALL criteria verified
3. Use colleague-shaped (5-7 score) for ambiguous specs
4. Check if budget/iteration limits are too low

### Session resumed but loop doesn't continue

**Cause:** SessionStart hook didn't detect active loop.

**Fix:**
1. Verify `.loop/state.json` exists with `status: "in_progress"`
2. Check that the file is valid JSON
3. The SessionStart hook announces resume — if no announcement, state file may be missing
