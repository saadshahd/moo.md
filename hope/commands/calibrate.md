---
description: Review confidence calibration from prediction history.
---

# /calibrate

Analyze prediction accuracy from `~/.claude/learnings/predictions.jsonl`.

## Analysis

1. **Load predictions**
2. **Group by confidence band** (90-100, 80-90, 70-80, 60-70)
3. **Calculate accuracy per band**
4. **Compare to expected** (X% confidence → ~X% accuracy)

## Report Format

```
## Calibration Report

Predictions: N total
- Confirmed: X (Y%)
- Refuted: X (Y%)
- Pending: X

By Confidence Band:
- 90-100%: X/Y correct (Z% actual vs ~95% expected)
- 80-90%:  X/Y correct (Z% actual vs ~85% expected)
- 70-80%:  X/Y correct (Z% actual vs ~75% expected)
- 60-70%:  X/Y correct (Z% actual vs ~65% expected)

Assessment: [well-calibrated / overconfident / underconfident]

Recommendations:
- [Specific adjustments based on data]
```

## Focus (optional)

$ARGUMENTS
