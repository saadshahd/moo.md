---
name: cancel
description: Cancel active loop. Triggers on "cancel loop", "stop loop", "abort", "halt", "end loop".
model: haiku
allowed-tools: Read
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

1. **Acknowledge cancel** — Confirm user intent to stop
2. **Report progress** — Summarize what was accomplished
3. **List remaining** — Show what's left undone

Current iteration completes before cancel takes effect. No mid-operation interruption.

## Output

```
Loop cancelled.

Accomplished:
- [list of completed work items]

Remaining:
- [list of incomplete work items]

To restart: /loop:start [spec]
```

## Guarantees

- All completed work preserved (no rollback)
- Clean termination (no dangling state)
- Full accounting (progress summary)
- Restart possible with same or modified spec
