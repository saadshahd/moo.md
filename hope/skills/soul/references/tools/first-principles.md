# First Principles Thinking

Break problems into fundamental truths and build up from there.

## When to Use

| Trigger                              | Use This Tool                |
| ------------------------------------ | ---------------------------- |
| "That's how it's always done"        | Challenge assumptions        |
| Complex problem, no obvious solution | Reason from basics           |
| Innovation needed                    | Escape conventional thinking |

## The Framework

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ANALOGY THINKING (default)                                │
│   ─────────────────────────                                 │
│   "Others do X, so we should do X"                          │
│   Problem: Inherits others' constraints                     │
│                                                             │
│                       vs.                                   │
│                                                             │
│   FIRST PRINCIPLES THINKING                                 │
│   ─────────────────────────                                 │
│   1. What do we know to be fundamentally true?              │
│   2. What assumptions are we making?                        │
│   3. What could we build from just the truths?              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## The Process

```
    ┌─────────────────────┐
    │ Current Belief      │  "Batteries are expensive"
    └──────────┬──────────┘
               │
               ▼  DECONSTRUCT
    ┌─────────────────────┐
    │ What is this made   │  Cobalt, nickel, lithium,
    │ of? (fundamentals)  │  carbon, steel, manufacturing
    └──────────┬──────────┘
               │
               ▼  VERIFY
    ┌─────────────────────┐
    │ What is true?       │  Raw materials = $80/kWh
    │ What is assumed?    │  "Expensive" is assumed
    └──────────┬──────────┘
               │
               ▼  RECONSTRUCT
    ┌─────────────────────┐
    │ Build from truths   │  Source materials differently,
    │                     │  new manufacturing process
    └─────────────────────┘
```

## Key Questions

| Step                     | Questions                                                     |
| ------------------------ | ------------------------------------------------------------- |
| **Identify assumptions** | What do we believe about this? Why do we believe it?          |
| **Find fundamentals**    | What is physically/mathematically true? What can't be argued? |
| **Challenge "rules"**    | Is this a law of nature or just convention?                   |
| **Rebuild**              | If we only knew the fundamentals, what would we build?        |

## How to Apply

1. **State the problem** and current approach
2. **List assumptions** embedded in current approach
3. **Question each assumption:** "Is this a fundamental truth?"
4. **Identify fundamentals:** What remains when assumptions are stripped?
5. **Rebuild solution** using only fundamentals
6. **Compare** new approach to conventional approach

## Example

**Problem:** "Our SaaS is too expensive to compete"

```
CURRENT BELIEF:
"We can't lower prices because servers and staff cost too much"

DECONSTRUCT:
├── Server costs: $10k/month
├── Engineering: $50k/month (2 people)
├── Support: $20k/month (1 person)
├── Marketing: $15k/month
└── Price: $100/user/month to be profitable

VERIFY ASSUMPTIONS:
├── "Need dedicated servers" → TRUE? Or assumed?
│   Fundamental: We need compute. (Not specific servers)
├── "Need 2 full-time engineers" → TRUE? Or assumed?
│   Fundamental: We need code maintained. (Not FTEs)
├── "Need support staff" → TRUE? Or assumed?
│   Fundamental: Users need help. (Not humans)

FUNDAMENTALS:
├── Need compute → could be serverless (pay per use)
├── Need code maintained → could be contractor + AI assist
├── Users need help → could be self-serve + AI chat

RECONSTRUCT:
├── Serverless: ~$2k/month (scales with usage)
├── Part-time contractor: $15k/month
├── AI support + docs: $2k/month
├── New cost: $34k/month (vs $95k)
└── New price: $40/user/month (competitive)
```

## Key Insight

Most constraints are inherited assumptions, not fundamental truths. First principles thinking strips away the assumptions to reveal what's actually required.
