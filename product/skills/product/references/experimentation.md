# Experimentation

A/B testing and controlled experiment framework.

## When to Experiment

| Situation | Experiment? | Why |
|-----------|-------------|-----|
| High uncertainty, reversible | **Yes** | Learn before committing |
| Clear winner, low stakes | No | Just ship it |
| High stakes, irreversible | **Careful A/B** | Staged rollout |
| Qualitative question | No | Use interviews instead |

## Experiment Design

### 1. Hypothesis

Format: "If [change], then [metric] will [direction] by [amount] because [mechanism]."

**Bad:** "Users will like the new design."
**Good:** "If we move CTA above fold, signup rate will increase 10% because visibility reduces friction."

### 2. Sample Size

Minimum detectable effect (MDE) determines required sample:

| MDE | Required per variant | Detection time at 1K/day |
|-----|---------------------|-------------------------|
| 20% | ~400 | 1 day |
| 10% | ~1,600 | 2 days |
| 5% | ~6,400 | 1 week |
| 2% | ~40,000 | 6 weeks |

**Rule of thumb:** 95% confidence, 80% power = 16 × (1/MDE²) per variant.

### 3. Metrics

| Type | Example | Purpose |
|------|---------|---------|
| **Primary** | Conversion rate | What you're optimizing |
| **Guardrail** | Page load time | Must not degrade |
| **Diagnostic** | Click-through rate | Explain primary result |

### 4. Duration

- Minimum: 1 full business cycle (usually 1 week)
- Maximum: 4 weeks (novelty effects fade)
- No peeking: Pre-commit to end date

## Statistical Rigor

### P-Values

| p-value | Interpretation | Action |
|---------|----------------|--------|
| < 0.01 | Strong evidence | Ship with confidence |
| 0.01-0.05 | Moderate evidence | Ship, monitor closely |
| 0.05-0.10 | Weak evidence | Consider extending test |
| > 0.10 | No evidence | Don't ship based on this |

### Confidence Intervals

Report as: "Variant B improved conversion by 12% [CI: 8%, 16%]"

If CI crosses zero, result is not significant.

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| **Peeking** | Pre-register end date, no early stops |
| **Multiple comparisons** | Bonferroni correction or fewer variants |
| **Novelty effect** | Run for 2+ weeks |
| **Selection bias** | Random assignment, check pre-experiment balance |
| **Survivorship bias** | Intent-to-treat analysis |

## Output Format

```
## Experiment: [Name]

### Hypothesis
If [change], then [metric] will [direction] by [amount].

### Design
- Variants: Control, Treatment A [, Treatment B]
- Traffic: 50/50 [or 33/33/33]
- Duration: [X days/weeks]
- Sample size needed: [N per variant]

### Metrics
- Primary: [metric]
- Guardrails: [metric1, metric2]
- Diagnostic: [metric]

### Results
| Variant | N | Conversion | vs Control | p-value |
|---------|---|------------|------------|---------|
| Control | X | Y% | - | - |
| Treatment | X | Y% | +Z% [CI] | 0.0X |

### Decision
[Ship / Don't ship / Extend / Iterate]
Confidence: [High/Medium/Low]
```

## Staged Rollouts

For high-stakes changes, use percentage ramps:

| Stage | Traffic | Duration | Gate |
|-------|---------|----------|------|
| 1 | 1% | 2 days | No crashes, errors < baseline |
| 2 | 10% | 1 week | Metrics neutral or positive |
| 3 | 50% | 1 week | Statistical significance reached |
| 4 | 100% | - | Ship complete |

Revert immediately if guardrails violated at any stage.
