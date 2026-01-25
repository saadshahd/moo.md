# Fit Decision

Before delegating to AI, score each dimension 0-10.

## Scoring Dimensions

| Dimension | 10 (Delegate) | 5 (Hybrid) | 0 (Keep) |
|-----------|---------------|------------|----------|
| **Spec Clarity** | Could write acceptance tests now | General direction, fuzzy details | Need drafts to know what I want |
| **Verification Cost** | Check in <5 min (tests, template match) | 15-30 min careful review | Expert-only, errors surface in production |
| **Reversibility** | Delete and retry, no cost | Some rework, contained | Downstream damage, reputation risk |
| **Hidden Coupling** | Fully isolated | Touches few systems | Deeply entangled, cascades unpredictably |
| **Shape Confidence** | Clear-cut choice | Could go either way | Not enough info to decide |

## Decision Rules

| Total Score | Shape | Action |
|-------------|-------|--------|
| **≥40** | Tool-shaped | Delegate and forget |
| **25-39** | Colleague-shaped | Iterate together |
| **<25** | Not ready | Clarify first, don't delegate |

## Failure Modes

| Wrong Choice | Symptom | Cost |
|--------------|---------|------|
| Tool-shaped task treated as colleague | Excessive check-ins, slow progress | Wasted attention, frustration |
| Colleague-shaped task treated as tool | Output misses mark, requires rework | Wasted cycles, drift |
| Not-ready task delegated anyway | Thrashing, conflicting outputs | Trust erosion, worse than manual |

## Pre-Delegation Checklist

1. Score all 5 dimensions honestly
2. If total <25, invest in spec clarity first
3. If total 25-39, plan iteration checkpoints
4. If total ≥40, write acceptance criteria and let go

## When to Re-Score

- After first draft reveals hidden complexity
- When scope changes mid-task
- When verification takes longer than expected
