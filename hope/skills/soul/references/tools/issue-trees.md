# Issue Trees

Decompose problems systematically using MECE principle.

## When to Use

| Trigger                       | Use This Tool               |
| ----------------------------- | --------------------------- |
| Complex problem to solve      | Break into manageable parts |
| Need to ensure nothing missed | MECE guarantees coverage    |
| Structuring analysis          | Organize thinking           |

## The Framework

```
                    ┌─────────────────────┐
                    │   ROOT QUESTION     │
                    │   "How might we...?"│
                    └──────────┬──────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
   ┌───────────┐         ┌───────────┐         ┌───────────┐
   │ Branch 1  │         │ Branch 2  │         │ Branch 3  │
   └─────┬─────┘         └─────┬─────┘         └─────┬─────┘
         │                     │                     │
    ┌────┴────┐           ┌────┴────┐           ┌────┴────┐
    │    │    │           │    │    │           │    │    │
   1.1  1.2  1.3         2.1  2.2  2.3         3.1  3.2  3.3

   MECE: Mutually Exclusive, Collectively Exhaustive
   - No overlap between branches
   - All possibilities covered
```

## MECE Principle

| Principle                   | Meaning                       | Test                                                   |
| --------------------------- | ----------------------------- | ------------------------------------------------------ |
| **Mutually Exclusive**      | No overlap between categories | "Could an item fit in two branches?" If yes, redefine. |
| **Collectively Exhaustive** | All possibilities covered     | "Is anything missing?" Add branch if yes.              |

## Tree Types

| Type          | Root Question                   | Use When             |
| ------------- | ------------------------------- | -------------------- |
| **Why tree**  | "Why is X happening?"           | Diagnosing problems  |
| **How tree**  | "How might we achieve X?"       | Generating solutions |
| **What tree** | "What are the components of X?" | Structuring analysis |

## How to Apply

1. **State root question** clearly
2. **Create first-level branches** (3-5 max)
3. **Check MECE:** No overlap? Nothing missing?
4. **Decompose each branch** into sub-branches
5. **Continue until actionable** (usually 2-4 levels)
6. **Prioritize branches** for investigation

## Example

**Root question:** Why is customer churn increasing?

```
                    ┌───────────────────────────────┐
                    │ Why is churn increasing?      │
                    └───────────────┬───────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
         ▼                          ▼                          ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ Product Issues  │      │ Service Issues  │      │ External Factors│
└────────┬────────┘      └────────┬────────┘      └────────┬────────┘
         │                        │                        │
    ┌────┼────┐              ┌────┼────┐              ┌────┼────┐
    │    │    │              │    │    │              │    │    │
    ▼    ▼    ▼              ▼    ▼    ▼              ▼    ▼    ▼
  Bugs  UX   Features    Support Response  Price  Competitor Economy
         │                 │                        │
         └─► Priority: UX  └─► Check metrics        └─► Analyze market

MECE CHECK:
✓ Mutually exclusive: Each cause fits one branch only
✓ Collectively exhaustive: Product, Service, External covers all causes
```

## Key Insight

The tree forces structured thinking. If you can't make branches MECE, you don't understand the problem well enough yet.
