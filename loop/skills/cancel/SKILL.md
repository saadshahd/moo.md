---
name: cancel
description: Cancel active Loop. Use when loop needs to stop early, done iterating manually, want to abort, or change direction. Triggers on "cancel loop", "stop iterating", "end loop", "terminate loop", "abort loop", "kill loop", "stop the loop", "halt". Graceful termination that preserves completed work.
---

# Cancel Loop

Gracefully terminate an active loop while preserving all completed work.

## When to Use

| Situation | Action |
|-----------|--------|
| **Need to change direction** | Cancel, then start new loop with updated spec |
| **Spec was wrong** | Cancel, clarify with `/hope:intent`, restart |
| **Good enough** | Cancel when partial progress is sufficient |
| **Taking too long** | Cancel to review approach before continuing |
| **Emergency stop** | Cancel immediately halts next iteration |

## Cancel vs Natural Completion

- **Natural completion:** Loop satisfied spec, clean exit with success summary
- **Cancel:** User-initiated stop, preserves progress, enables restart

Cancel when you want control back. Let it complete when spec is being satisfied.

## What Happens

1. **Find active loop** — TaskList for in_progress task (subject starts with "Complete:")
2. **Mark terminated** — TaskUpdate status=completed with cancellation note
3. **Report state** — Iterations, cost, accomplished work, remaining items

Current iteration completes before cancel takes effect. No mid-operation interruption.

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

## Guarantees

- All completed work preserved (no rollback)
- Clean termination (no dangling state)
- Full accounting (iterations, cost, progress)
- Restart possible with same or modified spec
