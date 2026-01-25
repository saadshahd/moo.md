---
name: help
description: Explain Loop plugin and available commands
---

# Loop Help

## What is Loop?

Autonomous iteration with spec-driven quality gates. Give it a task, it keeps working until done or limits hit.

## Commands

| Command | Purpose |
|---------|---------|
| `/loop` | Start new autonomous loop |
| `/loop continue` | Resume paused loop |
| `/loop cancel` | Terminate current loop |

## How It Works

1. **Score your spec** against 5-dimension rubric (Outcome, Scope, Constraints, Success, Done)
2. **Determine shape:** Tool (≥8/10, autonomous) or Colleague (5-7/10, interactive)
3. **Iterate** using Tasks API for state persistence
4. **Pause on limits** — budget, iterations, or circuit breakers
5. **Resume anytime** with `/loop continue`

## Limits

| Protection | Default |
|------------|---------|
| Budget | $25 |
| Iterations | 10 |
| Same error | 3x |
| Same file | 5x |

Override with `--budget=N` or `--iterations=N`.

## Tips

- Clear specs (≥8/10) run faster with less interruption
- Vague specs? Run `/hope:intent` first
- Pause is not failure — resume anytime
