# Eisenhower Matrix

Prioritize by urgency and importance.

## When to Use

| Trigger                 | Use This Tool                          |
| ----------------------- | -------------------------------------- |
| Overwhelmed with tasks  | Sort what actually matters             |
| Everything feels urgent | Distinguish real vs. perceived urgency |
| Tech debt triage        | Prioritize remediation backlog         |

## The Framework

```
                    │ URGENT               │ NOT URGENT
────────────────────┼──────────────────────┼──────────────────────
                    │                      │
      IMPORTANT     │     Q1: DO NOW       │    Q2: SCHEDULE
                    │                      │
                    │  • Crises            │  • Strategic work
                    │  • Deadlines         │  • Relationship building
                    │  • Emergencies       │  • Planning
                    │                      │  • Learning
                    │                      │
────────────────────┼──────────────────────┼──────────────────────
                    │                      │
    NOT IMPORTANT   │    Q3: DELEGATE      │    Q4: DELETE
                    │                      │
                    │  • Interruptions     │  • Time wasters
                    │  • Some meetings     │  • Busy work
                    │  • Some emails       │  • Pleasant activities
                    │                      │  • Trivia
                    │                      │
────────────────────┴──────────────────────┴──────────────────────
```

## Quadrant Actions

| Quadrant | Action               | Typical Time Budget            |
| -------- | -------------------- | ------------------------------ |
| **Q1**   | Do immediately       | ~20% (crises happen)           |
| **Q2**   | Schedule time blocks | ~60% (growth happens here)     |
| **Q3**   | Delegate or batch    | ~15% (necessary but low-value) |
| **Q4**   | Eliminate            | ~5% (audit regularly)          |

## How to Apply

1. **List all tasks** (brain dump)
2. **Ask two questions per task:**
   - Is this urgent? (Time-sensitive deadline?)
   - Is this important? (Moves key goals forward?)
3. **Place in quadrant**
4. **Act by quadrant:** Q1 now, Q2 schedule, Q3 delegate, Q4 delete

## Classification Questions

| Question                           | If Yes                       |
| ---------------------------------- | ---------------------------- |
| Does this block a shipped feature? | URGENT                       |
| Does this increase incident risk?  | IMPORTANT                    |
| Does this slow team velocity?      | IMPORTANT                    |
| Is someone just waiting on me?     | URGENT (maybe not important) |
| Is this only cosmetic/preference?  | Q4 (delete)                  |

## Example

**Situation:** Monday morning task triage

```
┌──────────────────────────────────────────────────────────┐
│                         URGENT                           │
├────────────────────────────┬─────────────────────────────┤
│ Q1: DO NOW                 │ Q2: SCHEDULE                │
│                            │                             │
│ • Fix auth bug (blocking)  │ • Refactor payment module   │
│ • Deploy hotfix            │ • Write Q2 roadmap          │
│ • Respond to SEC-1 ticket  │ • 1:1 prep for tomorrow     │
│                            │ • Review architecture doc   │
├────────────────────────────┼─────────────────────────────┤
│ Q3: DELEGATE               │ Q4: DELETE                  │
│                            │                             │
│ • Update team wiki         │ • Reorganize Notion         │
│ • Respond to vendor email  │ • "Nice to have" feature    │
│ • Schedule meeting rooms   │ • Old PR cleanup            │
│                            │                             │
└────────────────────────────┴─────────────────────────────┘
```

**Key insight:** Most people spend too much time in Q1 and Q3, not enough in Q2. Schedule Q2 work first.

---

*Source: Eisenhower Matrix, popularized by Covey*
