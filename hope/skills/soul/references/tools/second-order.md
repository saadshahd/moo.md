# Second-Order Thinking

Consider consequences of consequences before acting.

## When to Use

| Trigger                          | Use This Tool                |
| -------------------------------- | ---------------------------- |
| Big decision with lasting impact | Check downstream effects     |
| "This seems too easy"            | Find hidden costs            |
| Policy or process change         | Anticipate behavioral shifts |

## The Framework

```
    ACTION
       │
       ▼
┌──────────────────┐
│  1st ORDER       │  "And then what?"
│  EFFECT          │
│  (immediate)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  2nd ORDER       │  "And then what?"
│  EFFECT          │
│  (downstream)    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  3rd ORDER       │  (usually stop here)
│  EFFECT          │
│  (systemic)      │
└──────────────────┘
```

## Questions to Ask

| Order | Question                                        |
| ----- | ----------------------------------------------- |
| 1st   | What happens immediately?                       |
| 2nd   | What happens as a result of that?               |
| 3rd   | What behaviors does this incentivize long-term? |

## How to Apply

1. State the action clearly
2. Ask "And then what?" → Write 1st order effect
3. Ask "And then what?" again → Write 2nd order effect
4. Ask "What behavior does this incentivize?" → Write 3rd order
5. Evaluate: Are 2nd/3rd order effects acceptable?

## Common Patterns

| 1st Order Looks Like | 2nd/3rd Order Reality           |
| -------------------- | ------------------------------- |
| Save money           | Quality drops → customers leave |
| Move faster          | Tech debt → slow later          |
| Add metric           | Gaming the metric               |
| Hire quickly         | Culture dilutes                 |
| Give discount        | Anchor low price                |

## Example

**Action:** Add strict code coverage requirement (80% minimum)

```
1st Order Effect:
├── Teams write more tests ✓
├── Coverage numbers go up ✓
└── Feels like quality improved ✓

2nd Order Effect:
├── Tests written to hit number, not catch bugs
├── Trivial tests (getters/setters) proliferate
├── Build times increase
└── Developers game the metric

3rd Order Effect:
├── "Coverage theater" becomes norm
├── Actual quality flat or declining
├── Trust in metrics erodes
└── Resentment toward process
```

**Better approach:**

- Require coverage for critical paths only
- Review test quality, not just quantity
- Track bugs escaped to production instead

## Key Insight

First-order thinking: "This action has this benefit."
Second-order thinking: "This action has this benefit, which causes these effects, which incentivizes these behaviors."

Most bad decisions look good at first order.
