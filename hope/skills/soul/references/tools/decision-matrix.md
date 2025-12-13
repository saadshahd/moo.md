# Weighted Decision Matrix

Choose the best option when multiple factors matter.

## When to Use

| Trigger                                         | Use This Tool             |
| ----------------------------------------------- | ------------------------- |
| 3+ options, no obvious winner                   | Systematic comparison     |
| Multiple stakeholders with different priorities | Make tradeoffs explicit   |
| Need defensible, documented decision            | Audit trail for rationale |

## The Framework

```
┌─────────────────┬────────┬──────────┬──────────┬──────────┐
│ Criterion       │ Weight │ Option A │ Option B │ Option C │
├─────────────────┼────────┼──────────┼──────────┼──────────┤
│ [Criterion 1]   │   X%   │   [1-5]  │   [1-5]  │   [1-5]  │
│ [Criterion 2]   │   X%   │   [1-5]  │   [1-5]  │   [1-5]  │
│ [Criterion 3]   │   X%   │   [1-5]  │   [1-5]  │   [1-5]  │
│ [Criterion 4]   │   X%   │   [1-5]  │   [1-5]  │   [1-5]  │
├─────────────────┼────────┼──────────┼──────────┼──────────┤
│ WEIGHTED TOTAL  │  100%  │   X.X    │   X.X    │   X.X    │
└─────────────────┴────────┴──────────┴──────────┴──────────┘
                                        ▲
                              Highest score = recommendation
```

## Scoring Guide

| Score | Meaning                    |
| ----- | -------------------------- |
| 1     | Does not meet criterion    |
| 2     | Partially meets            |
| 3     | Meets criterion adequately |
| 4     | Exceeds criterion          |
| 5     | Best possible fit          |

## How to Apply

1. **List criteria**: What matters for this decision?
2. **Assign weights**: Must sum to 100%. Higher = more important.
3. **Score options**: 1-5 for each option against each criterion
4. **Calculate**: Weighted score = Σ(score × weight)
5. **Sensitivity check**: Would changing one weight flip the result?

## Example

**Decision:** Which auth library for new project?

```
┌───────────────────┬────────┬───────┬───────┬────────┐
│ Criterion         │ Weight │ Auth0 │ Clerk │ Custom │
├───────────────────┼────────┼───────┼───────┼────────┤
│ Time to ship      │   30%  │   4   │   5   │   1    │
│ Customization     │   20%  │   3   │   3   │   5    │
│ Maintenance cost  │   25%  │   4   │   4   │   2    │
│ Security posture  │   25%  │   5   │   4   │   2    │
├───────────────────┼────────┼───────┼───────┼────────┤
│ WEIGHTED TOTAL    │  100%  │  4.0  │  4.1  │  2.4   │
└───────────────────┴────────┴───────┴───────┴────────┘

Calculation for Auth0:
(4 × 0.30) + (3 × 0.20) + (4 × 0.25) + (5 × 0.25)
= 1.2 + 0.6 + 1.0 + 1.25 = 4.05 ≈ 4.0
```

**Winner:** Clerk (4.1)

**Sensitivity check:** If security weight increased to 35%, Auth0 would win. Document this tradeoff.

## Common Pitfalls

| Pitfall               | Fix                                  |
| --------------------- | ------------------------------------ |
| Too many criteria     | Keep to 4-6 most important           |
| Equal weights         | Forces you to pick what matters most |
| Score inflation       | Anchor on 3 = "adequate"             |
| Ignoring close scores | Within 0.3 = effectively tied        |

---

*Source: Pugh Matrix, Stuart Pugh 1980s*
