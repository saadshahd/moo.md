---
name: status
description: Display loop progress. Use when asking "where am I", "loop status", "what's the progress", "how far along", "what's left".
model: haiku
allowed-tools: Read
---

# Loop Status

Display current loop progress from conversation context.

## When This Activates

- "loop status", "show status"
- "where am I", "what's the progress"
- "how far along", "what's left"

---

## Protocol

### 1. Gather Context

Scan conversation history for:
- Last `[LOOP] Starting` announcement (spec score, shape, item count)
- Last `[WAVE N COMPLETE]` log (current wave, completion progress)
- Any `<loop-complete>` marker (loop finished)
- Any pending blockers or counsel:panel reviews

### 2. Display Status

```
╭─ LOOP STATUS ───────────────────────────────────╮
│ Shape: {shape_chosen} ({spec_score}/10 spec)    │
├─────────────────────────────────────────────────┤
│ Items: {completed}/{total} complete             │
│   ✓ Completed: {N}                              │
│   ▸ In Progress: {N}                            │
│   ○ Remaining: {N}                              │
├─────────────────────────────────────────────────┤
│ Wave: {wave_number}                             │
│ Last Review: {passed/pending}                   │
╰─────────────────────────────────────────────────╯

Next: {suggested_action}
```

### 3. Suggest Next Action

| State | Suggested Action |
|-------|-----------------|
| No loop in conversation | "Run `/loop:start [task]` to start a new loop" |
| Loop in progress | "Run `/loop:start` to continue" |
| Review pending | "Resolve {N} blockers, then continue" |
| Complete | "Loop finished. Run `/loop:start [new task]` for new work" |

---

## No Active Loop

If no loop markers found in conversation:

```
╭─ LOOP STATUS ───────────────────────────────────╮
│ No active loop detected.                        │
│                                                 │
│ Start a new loop:                               │
│   /loop:start "add auth to app"                 │
╰─────────────────────────────────────────────────╯
```

---

## Commands

| Command | Effect |
|---------|--------|
| `/loop:status` | Show current progress (this command) |
| `/loop:start` | Resume or start loop |
| `/loop:cancel` | Terminate and clean up |
