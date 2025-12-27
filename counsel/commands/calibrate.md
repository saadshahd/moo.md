---
description: Correct expert simulation errors. Use when a simulated perspective doesn't match the expert's documented positions.
---

# /counsel:calibrate

Correct and refine expert simulations.

## Usage

```
/counsel:calibrate "Hickey wouldn't say that — he'd question the abstraction entirely"
/counsel:calibrate osmani: he focuses more on user experience than raw performance
```

## Inputs

- `$1` — Correction description (required)
- Expert name can be explicit or inferred from recent context

## Process

1. Acknowledge correction
2. Ask for specifics if needed: "What would [Expert] say instead?"
3. Log calibration to `.claude/logs/counsel-calibrations.jsonl`:
   ```json
   {"ts": "...", "expert": "...", "wrong": "...", "correct": "...", "context": "...", "source": "..."}
   ```
4. Confirm: future simulations avoid "wrong" pattern, lean toward "correct"

## Application

When simulating a calibrated expert: load calibrations, filter by expert, avoid wrong patterns, lean toward correct ones. Note "(adjusted per calibration)" when applied.

## Constraints

- Only calibrate for specific, documentable corrections
- Do not change confidence score based on calibrations
- Calibrations are project-local (different projects may have different calibrations)
- Acknowledge uncertainty if correction seems to conflict with documented work
