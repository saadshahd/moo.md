---
name: status
description: Display loop state. Use when asking "where am I", "loop status", "what's the progress", "how far along", "what's left".
model: haiku
allowed-tools: Read, TaskList
---

# Loop Status

Display current workflow state without modifying anything.

## When This Activates

- "loop status", "show status"
- "where am I", "what's the progress"
- "how far along", "what's left"

---

## Protocol

### 1. Read Workflow State

```
Read .loop/workflow-state.json if exists
Read .loop/shape/SHAPE.md if exists
Read .loop/current-context.json if exists
TaskList() to get task counts
```

### 2. Display Status

```
╭─ LOOP STATUS ───────────────────────────────────╮
│ Stage: {stage} ({spec_score}/10 spec)           │
│ Shape: {shape_chosen} (fit: {fit_score})        │
├─────────────────────────────────────────────────┤
│ Tasks: {completed}/{total} complete             │
│   ✓ Completed: {N}                              │
│   ▸ In Progress: {N}                            │
│   ○ Pending: {N}                                │
├─────────────────────────────────────────────────┤
│ Wave: {wave_number} ({completed}/{task_count})   │
│ Reviews:                                        │
│   Wave 1: {score}/10 ({issues} issues)          │
│   Wave 2: {score}/10 ({issues} issues)          │
│   Thorough: {passed ? "✓ Passed" : "Pending"}   │
├─────────────────────────────────────────────────┤
│ Started: {started_at}                           │
│ Last Update: {last_updated}                     │
╰─────────────────────────────────────────────────╯

Next: {suggested_action}
```

### 3. Suggest Next Action

Based on current stage:

| Stage | Suggested Action |
|-------|-----------------|
| (no state) | "Run `/loop:start [task]` to start a new loop" |
| intent | "Run `/loop:start` to continue to shape" |
| shape | "Run `/loop:start` to start decomposition" |
| decompose | "Run `/loop:start` to begin execution" |
| executing | "Run `/loop:start` to continue wave {N}" |
| review | "Run `/loop:start` to resolve {blockers} blockers" |
| complete | "Loop finished. Run `/loop:start [new task]` for new work" |

---

## No State Found

If no `.loop/workflow-state.json` exists:

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
| `/loop:status` | Show current state (this command) |
| `/loop:start` | Resume or start loop |
| `/loop:cancel` | Terminate and clean up |
