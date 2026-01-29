# Loop Mechanics

## Command-Based Stop Hook

The loop uses a **deterministic bash script** for stop decisions, not an LLM prompt. This ensures reliable, predictable behavior.

### Hook Configuration

```json
{
  "Stop": [{
    "hooks": [{
      "type": "command",
      "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/stop-check.sh",
      "timeout": 10
    }]
  }]
}
```

### Stop Decision Logic

The `stop-check.sh` script reads `.loop/state.json` and makes a deterministic decision:

```
1. No state file? → {ok: true} (no active loop)
2. Status is "completed" or "cancelled"? → {ok: true}
3. Circuit breaker stuckCount >= 5? → {ok: true}
4. ALL criteriaStatus true AND exit_signal true? → {ok: true}
5. Otherwise → {ok: false, reason: "unmet criteria: X, Y"}
```

### Why Command-Based?

| Approach | Problem |
|----------|---------|
| Prompt-based | LLM cannot reliably read files, defaults to stopping |
| Command-based | Bash script reads file directly, deterministic result |

---

## Dual-Condition Exit

The stop hook requires **both** conditions to allow stopping:

1. **All `criteriaStatus` values are `true`**
2. **`exit_signal` is `true`**

### Why Both?

| Condition | Purpose |
|-----------|---------|
| criteriaStatus | Tracks actual verification of each criterion |
| exit_signal | Claude's explicit intent to complete |

This prevents:
- Premature stops when criteria not actually verified
- Accidental stops from state file initialization
- Stops when Claude hasn't confirmed completion

---

## State File Schema

```json
{
  "spec": "original user request verbatim",
  "criteria": ["tests pass", "lint clean", "no type errors"],
  "criteriaStatus": {
    "tests pass": false,
    "lint clean": true,
    "no type errors": false
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

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| spec | string | Original user request, verbatim |
| criteria | string[] | List of success criteria |
| criteriaStatus | object | Map of criterion → true/false |
| exit_signal | boolean | True only when ALL criteria verified |
| steps | string[] | Planned work steps |
| completedSteps | string[] | Finished steps |
| remainingSteps | string[] | Steps not yet done |
| iteration | number | Current iteration count |
| status | string | "in_progress", "completed", "cancelled" |
| circuitBreaker | object | Stuck detection state |

### Circuit Breaker Object

```json
{
  "stuckCount": 0,
  "lastUnmet": "tests pass"
}
```

- `stuckCount`: Incremented when same criteria remain unmet across iterations
- `lastUnmet`: First unmet criterion from previous iteration (for comparison)

---

## Session Resume

The `session-resume.sh` script runs on SessionStart:

1. Check if `.loop/state.json` exists
2. If status is "in_progress", output resume announcement
3. Otherwise, output empty message

### Resume Announcement Format

```
[LOOP RESUME] Active loop detected
Spec: [spec summary]
Progress: N/M steps | Iteration: X
Unmet criteria: [list]
Next: [first remaining step]
```

---

## State Lifecycle

### On Loop Start

1. Parse user spec
2. Score against rubric
3. Extract criteria from spec
4. Decompose into steps
5. Write initial `.loop/state.json`:
   - All criteriaStatus values: `false`
   - exit_signal: `false`
   - status: `"in_progress"`
   - circuitBreaker: `{stuckCount: 0, lastUnmet: ""}`

### On Each Iteration

1. Execute one step
2. Run verification for affected criteria
3. Update criteriaStatus based on verification
4. Check circuit breaker:
   - Get first unmet criterion
   - If same as lastUnmet, increment stuckCount
   - If different, reset stuckCount to 0
   - Update lastUnmet
5. If ALL criteriaStatus true, set exit_signal: true
6. Write updated state file
7. Output status block

### On Completion

1. Verify all criteriaStatus values are true
2. Set exit_signal: true
3. Set status: "completed"
4. Write final state
5. Output `<loop-complete>` marker

### On Cancel

1. Set status: "cancelled"
2. Write state (preserves progress)
3. Report completed/remaining work

---

## Troubleshooting

### Loop stops too early

**Cause:** State file missing, exit_signal true by accident, or criteriaStatus incorrect.

**Fix:**
1. Verify `.loop/state.json` exists at loop start
2. Ensure exit_signal starts as `false`
3. Only set exit_signal `true` after verifying ALL criteria

### Loop runs forever

**Cause:** exit_signal never set to true, or criteriaStatus never updated.

**Fix:**
1. After each iteration, update criteriaStatus with actual verification results
2. When ALL criteria pass, explicitly set exit_signal: true
3. Check circuit breaker is incrementing stuckCount

### Circuit breaker triggers unexpectedly

**Cause:** Same criterion failing repeatedly.

**Fix:**
1. Check the criterion is achievable
2. Review the verification command for that criterion
3. Consider if the approach needs to change

### Session resume doesn't work

**Cause:** State file missing or status not "in_progress".

**Fix:**
1. Verify `.loop/state.json` exists
2. Check status field is "in_progress"
3. Ensure the file is valid JSON
