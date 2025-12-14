# Connection Circles

Map causal relationships to understand system behavior.

## When to Use

| Trigger                           | Use This Tool            |
| --------------------------------- | ------------------------ |
| Complex problem with many factors | Visualize relationships  |
| "Everything affects everything"   | Find key leverage points |
| Planning intervention             | Predict ripple effects   |

## The Framework

```
    ┌─────────────────────────────────────────┐
    │                                         │
    │      A ─────────────▶ B                 │
    │      │                │                 │
    │      │                │                 │
    │      ▼                ▼                 │
    │      C ◀──────────── D                  │
    │      │                ▲                 │
    │      │                │                 │
    │      └────────────────┘                 │
    │                                         │
    │   Arrow = "affects" or "leads to"       │
    │   + = same direction (more→more)        │
    │   - = opposite direction (more→less)    │
    │                                         │
    └─────────────────────────────────────────┘
```

## How to Apply

1. **List key variables** (5-10 max)
2. **Draw connections:** Does A affect B? Draw arrow A → B
3. **Label direction:** + (same) or - (opposite)
4. **Find loops:** Follow arrows back to start
5. **Identify leverage:** Variables with many outgoing arrows

## Reading Connections

| Notation     | Meaning                       | Example                            |
| ------------ | ----------------------------- | ---------------------------------- |
| A →(+) B     | More A causes more B          | More marketing → more leads        |
| A →(-) B     | More A causes less B          | More automation → less manual work |
| Loop all (+) | Reinforcing (growth/collapse) | Viral growth                       |
| Loop has (-) | Balancing (stabilizing)       | Supply/demand                      |

## Example

**System:** SaaS customer lifecycle

```
        Marketing      (+)       Trials
        Spend ──────────────────▶ Started
           │                        │
           │                        │(+)
           │                        ▼
           │                    Conversions
           │                        │
           │         (+)            │(+)
           │◀────────────────────── │
           │        Revenue         ▼
           │                     Revenue
           │                        │
           │                        │(+)
           │         (-)            ▼
           └───────────────────  Churn
                                    │
                                    │(-)
                                    ▼
                                Active Users
```

**Loops identified:**

- (R1) Growth engine: Spend → Trials → Revenue → more Spend
- (B1) Churn drag: More users → more churn → less revenue
- (B2) Efficiency: More revenue → less relative spend needed

**Leverage point:** Reduce churn (affects multiple loops)

## Key Insight

Connection circles reveal non-obvious relationships. The goal isn't to map everything—it's to find the 2-3 variables where intervention has outsized effect.

---

_Source: Systems Thinking, Senge/Meadows_
