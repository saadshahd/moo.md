# Iceberg Model

Uncover root causes by looking below surface events.

## When to Use

| Trigger                        | Use This Tool            |
| ------------------------------ | ------------------------ |
| Same problem keeps recurring   | Find structural cause    |
| Quick fixes don't stick        | Dig deeper than symptoms |
| "Why does this always happen?" | Expose hidden patterns   |

## The Framework

```
═══════════════════════════════════════════════
                 EVENTS (Visible)
           "What happened this time?"
───────────────────────────────────────────────
               PATTERNS (Trends)
         "What trends have we seen?"
───────────────────────────────────────────────
           STRUCTURES (Systems)
       "What systems enable this?"
───────────────────────────────────────────────
         MENTAL MODELS (Beliefs)
        "What assumptions drive us?"
═══════════════════════════════════════════════
        ▲                              ▲
    Surface                         Root
    (React)                       (Transform)
```

## Levels Explained

| Level             | Question               | Intervention Type                  |
| ----------------- | ---------------------- | ---------------------------------- |
| **Events**        | What happened?         | Reactive - fix the incident        |
| **Patterns**      | What trends recur?     | Anticipatory - predict and prepare |
| **Structures**    | What enables this?     | Redesign - change the system       |
| **Mental Models** | What beliefs drive us? | Transform - shift thinking         |

## How to Apply

1. Start at **Events**: Describe what happened
2. Look for **Patterns**: Has this happened before? When? How often?
3. Find **Structures**: What processes, incentives, or rules allow this?
4. Expose **Mental Models**: What beliefs or assumptions created those structures?
5. Intervene at the deepest level you can influence

## Example

**Event:** Production deploy caused 2-hour outage

```
═══════════════════════════════════════════════
    EVENT: Deploy broke production for 2 hours
═══════════════════════════════════════════════
    PATTERN: Deploys fail ~once/month
             Usually on Fridays
             Usually affect auth service
───────────────────────────────────────────────
    STRUCTURE: No staging environment
               Manual deploy process
               No rollback automation
               Friday deploy not blocked
───────────────────────────────────────────────
    MENTAL MODEL: "We ship fast"
                  "Testing slows us down"
                  "We'll fix it in prod"
═══════════════════════════════════════════════
```

**Intervention:**

- Surface fix: Rollback this deploy
- Deep fix: Challenge "testing slows us down" belief, add staging

---

_Source: Systems Thinking iceberg model_
