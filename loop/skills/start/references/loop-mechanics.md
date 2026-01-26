# Loop Mechanics

## Tasks API Integration

The loop uses Tasks API for persistent state across iterations.

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

The stop hook checks for `<loop-complete>` in the last message:

```
<loop-complete>
All success criteria satisfied:
- [criterion]: ✓
</loop-complete>
```

If found → `{"ok": true, "reason": "complete"}`
If not found → `{"ok": false, "reason": "next: [action]"}`

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

**Cause:** Missing `<loop-complete>` marker or stop_hook_active not being tracked.

**Fix:**
1. Ensure you output `<loop-complete>` when all criteria are met
2. Check circuit breakers are triggering (same error 3x, etc.)
3. Verify stop_hook_active counter logic is working

### Loop stops too early

**Cause:** False positive on completion detection.

**Fix:**
1. Don't output `<loop-complete>` until ALL criteria verified
2. Use colleague-shaped (5-7 score) for ambiguous specs
3. Check if budget/iteration limits are too low
