# Incentives

Predict and explain behavior by finding the reward structure.

## When to Use

| Trigger                        | Use This Tool               |
| ------------------------------ | --------------------------- |
| "Why do they keep doing X?"    | Find the hidden incentive   |
| Designing a system or policy   | Check what you're rewarding |
| Policy not working as intended | Look for perverse effects   |

## The Framework

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   "Show me the incentive, I'll show you the outcome."   │
│                                        — Charlie Munger │
│                                                         │
│   ┌──────────┐      ┌──────────┐      ┌──────────┐     │
│   │ Incentive│─────▶│ Behavior │─────▶│ Outcome  │     │
│   └──────────┘      └──────────┘      └──────────┘     │
│                                                         │
│   To change the outcome, change the incentive.          │
│   Never assume people act against their incentives.     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Incentive Types

| Type          | Mechanism                     | Example                               |
| ------------- | ----------------------------- | ------------------------------------- |
| **Financial** | Money, bonuses, equity        | Sales commission → aggressive selling |
| **Social**    | Status, recognition, approval | Leaderboards → competitive behavior   |
| **Moral**     | Duty, ethics, identity        | "Do the right thing" → intrinsic care |
| **Fear**      | Avoiding pain or loss         | Deadline pressure → rushing           |

## How to Apply

1. **Observe the behavior** you want to understand or change
2. **Ask:** "What is this person/team rewarded for?"
3. **Map explicit incentives** (KPIs, bonuses, metrics)
4. **Map implicit incentives** (what gets attention, praise, promotion)
5. **Check for misalignment:** Does the incentive produce the desired outcome?
6. **Redesign:** Align incentive with the outcome you actually want

## Common Perverse Incentives

| Incentive              | Intended Outcome | Actual Outcome           |
| ---------------------- | ---------------- | ------------------------ |
| Pay per bug found      | More testing     | Creating bugs to find    |
| Lines of code written  | Productivity     | Verbose, unmaintainable  |
| Tickets closed per day | Fast support     | Cherry-picking easy ones |
| Meetings attended      | Collaboration    | Calendar bloat           |

## Example

**Problem:** Engineering team taking shortcuts despite quality push

```
Analysis:
┌─────────────────────────────────────────────────────────┐
│                                                         │
│ STATED INCENTIVE          ACTUAL INCENTIVE              │
│ ────────────────          ────────────────              │
│ "Ship quality code"       Sprint velocity points        │
│ "Take your time"          Deadlines never move          │
│ "Write tests"             Tests not in story points     │
│                                                         │
│ MISALIGNMENT: Velocity rewarded, quality is lip service │
│                                                         │
└─────────────────────────────────────────────────────────┘

Fix: Include test coverage in "done" definition.
     Count refactoring in velocity.
     Celebrate debt paydown publicly.
```

**Munger's Rule:** Never, ever, think about something else when you should be thinking about the power of incentives.

---

_Source: Charlie Munger, Poor Charlie's Almanack_
