---
name: status
description: Show current loop workflow state. Use when asking "where am I", "loop status", "what's the progress". Shows stage, scores, task progress, and next suggested action.
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
| (no state) | "Run `/loop [task]` to start a new loop" |
| intent | "Run `/loop` to continue to shape" |
| shape | "Run `/loop` to start decomposition" |
| decompose | "Run `/loop` to begin execution" |
| executing | "Run `/loop` to continue wave {N}" |
| review | "Run `/loop` to resolve {blockers} blockers" |
| complete | "Loop finished. Run `/loop [new task]` for new work" |

---

## No State Found

If no `.loop/workflow-state.json` exists:

```
╭─ LOOP STATUS ───────────────────────────────────╮
│ No active loop detected.                        │
│                                                 │
│ Start a new loop:                               │
│   /loop "add auth to app"                       │
│                                                 │
│ Or check task list:                             │
│   /loop continue                                │
╰─────────────────────────────────────────────────╯
```

---

## Commands

| Command | Effect |
|---------|--------|
| `/loop status` | Show current state (this command) |
| `/loop` | Resume or start loop |
| `/loop continue` | Resume paused loop |
| `/loop cancel` | Terminate and clean up |
