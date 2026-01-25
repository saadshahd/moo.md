# Loop Mechanics

## Tasks API Integration

The loop uses Tasks API for persistent state across iterations.

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
