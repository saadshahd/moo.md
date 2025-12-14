# ADR-001: Predictions Deferred

**Status:** Accepted
**Date:** 2025-12-08

## Context

The learnings system included four categories: failures, discoveries, constraints, and predictions. Predictions tracked confidence calibration—logging statements like "80% confident this fix works" then marking them confirmed or refuted.

## Decision

Keep only failures, discoveries, and constraints.

## What We Tried

1. **Transcript extraction** — Unreliable. Confidence statements vary in format and remain implicit.

2. **Hook-based capture** — Required regex parsing of Claude's output. Fragile, prone to false positives.

## Why We Stopped

- No reliable capture
- Core system (failures/discoveries/constraints) works without it
- Complexity exceeded benefit

## Future Options

1. **`/hope:predict` command** — Explicit logging. Adds friction.
2. **Structured output hook** — Claude Code could add structured prediction output.
3. **Post-session review** — Manual extraction via `/hope:learn`.

## Consequences

- `/hope:calibrate` non-functional (no data)
- Confidence calibration requires manual tracking
- Fewer moving parts

## Files Changed

- `hope/skills/soul/SKILL.md` — Removed predictions.jsonl
- `hope/commands/calibrate.md` — Stubbed
