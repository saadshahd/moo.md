# Impact-Effort Matrix

Prioritize by weighing results against required work.

## When to Use

| Trigger              | Use This Tool                  |
| -------------------- | ------------------------------ |
| Backlog grooming     | Find quick wins and big bets   |
| Sprint planning      | Balance effort across items    |
| Resource constraints | Maximize value per effort unit |

## The Framework

```
                    │ LOW EFFORT           │ HIGH EFFORT
────────────────────┼──────────────────────┼──────────────────────
                    │                      │
    HIGH IMPACT     │    QUICK WINS        │    BIG BETS
                    │    ★★★★★             │    ★★★★☆
                    │                      │
                    │  Do first            │  Plan carefully
                    │  Low risk, high ROI  │  High risk, high reward
                    │                      │
────────────────────┼──────────────────────┼──────────────────────
                    │                      │
    LOW IMPACT      │    FILL-INS          │    MONEY PITS
                    │    ★★☆☆☆             │    ★☆☆☆☆
                    │                      │
                    │  Do when blocked     │  Avoid or descope
                    │  Nice-to-have        │  Waste of resources
                    │                      │
────────────────────┴──────────────────────┴──────────────────────
```

## Priority Order

| Priority | Quadrant       | Strategy                                |
| -------- | -------------- | --------------------------------------- |
| 1st      | **Quick Wins** | Do immediately—best ROI                 |
| 2nd      | **Big Bets**   | Validate assumptions first, then commit |
| 3rd      | **Fill-Ins**   | Use slack time, don't prioritize        |
| 4th      | **Money Pits** | Kill or radically descope               |

## How to Apply

1. **List items** to prioritize
2. **Score impact** (1-5): What's the value if done?
3. **Score effort** (1-5): How much work to complete?
4. **Plot on matrix**
5. **Sequence:** Quick Wins → Big Bets → Fill-Ins → (skip Money Pits)

## Scoring Guide

**Impact:**
| Score | Meaning |
|-------|---------|
| 5 | Revenue/critical path |
| 4 | Major user benefit |
| 3 | Noticeable improvement |
| 2 | Minor benefit |
| 1 | Nice-to-have |

**Effort:**
| Score | Meaning |
|-------|---------|
| 5 | Weeks, multiple people |
| 4 | Week, dedicated person |
| 3 | Days of work |
| 2 | Hours of work |
| 1 | < 1 hour |

## Example

**Situation:** Prioritizing 6 feature requests

```
┌──────────────────────────────────────────────────────────┐
│                    LOW EFFORT                            │
├────────────────────────────┬─────────────────────────────┤
│ QUICK WINS ★★★★★           │ BIG BETS ★★★★☆              │
│                            │                             │
│ • Add dark mode toggle     │ • Rebuild search (3 weeks)  │
│   Impact: 4, Effort: 2     │   Impact: 5, Effort: 5      │
│                            │                             │
│ • Cache API responses      │ • Mobile app MVP (8 weeks)  │
│   Impact: 4, Effort: 2     │   Impact: 5, Effort: 5      │
│                            │                             │
├────────────────────────────┼─────────────────────────────┤
│ FILL-INS ★★☆☆☆             │ MONEY PITS ★☆☆☆☆            │
│                            │                             │
│ • Update footer links      │ • Custom email templates    │
│   Impact: 1, Effort: 1     │   Impact: 2, Effort: 4      │
│                            │                             │
│ • Add loading spinners     │ • Build admin dashboard     │
│   Impact: 2, Effort: 1     │   Impact: 2, Effort: 5      │
│                            │                             │
└────────────────────────────┴─────────────────────────────┘

Priority: Dark mode → Cache API → Search rebuild (validate first)
Skip: Admin dashboard (money pit)
```

---

_Source: 2x2 prioritization, Agile/Lean practice_
