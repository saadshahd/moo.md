---
name: cancel
description: Cancel active Loop
---

# Cancel Loop

## Action

1. TaskList to find active loop task (status=in_progress, subject starts with "Complete:")
2. TaskUpdate status=completed with cancellation note
3. Report final state: iterations completed, cost incurred, work accomplished

## Output

```
Loop cancelled.

Completed: [N] iterations, $[X] cost
Accomplished:
- [list of completed steps]

Remaining:
- [list of incomplete steps]

To restart: /loop [spec]
```

## Notes

- Cancellation preserves completed work
- No rollback of changes made
- Clean termination, no dangling state
