# Cynefin Framework

Classify problem domains to choose the right approach.

## When to Use

| Trigger                       | Use This Tool                    |
| ----------------------------- | -------------------------------- |
| Starting a new task           | Choose approach before diving in |
| Stuck on a problem            | Check if you're in wrong domain  |
| Team disagreement on approach | Align on problem type first      |

## The Framework

```
           │ UNORDERED              │ ORDERED
───────────┼────────────────────────┼────────────────────────
           │                        │
COMPLEX    │ probe → sense → respond│ COMPLICATED
           │                        │ sense → analyze → respond
           │ Run safe-to-fail       │
           │ experiments            │ Get expert analysis
           │                        │
           │ "Why are users         │ "Optimize DB queries"
           │  churning?"            │ "Design auth system"
           │                        │
───────────┼────────────────────────┼────────────────────────
           │                        │
CHAOTIC    │ act → sense → respond  │ CLEAR
           │                        │ sense → categorize → respond
           │ Stabilize first,       │
           │ learn later            │ Follow best practices
           │                        │
           │ "Production is down!"  │ "Reset user password"
           │ "Security breach"      │ "Fix typo in UI"
           │                        │
───────────┴────────────────────────┴────────────────────────
                        │
                   CONFUSION
              "I don't know which
               domain this is"
```

## Domain Actions

| Domain          | Characteristics                              | Response                                     |
| --------------- | -------------------------------------------- | -------------------------------------------- |
| **Clear**       | Obvious cause-effect, best practices exist   | Categorize and apply known solution          |
| **Complicated** | Cause-effect requires analysis, experts help | Analyze, then respond with designed solution |
| **Complex**     | Cause-effect only visible in hindsight       | Experiment with safe-to-fail probes          |
| **Chaotic**     | No cause-effect, crisis mode                 | Act immediately to stabilize                 |
| **Confusion**   | Don't know which domain                      | Break problem down, gather more data         |

## How to Apply

1. Ask: "Do I know the solution?"
   - Yes → Clear or Complicated
   - No → Complex or Chaotic
2. Ask: "Is there time to analyze?"
   - Yes → Complicated or Complex
   - No → Clear or Chaotic
3. Match domain to response pattern
4. Watch for domain shifts as situation evolves

## Example

**Situation:** User engagement dropped 30% this quarter

```
Domain assessment:
- Do we know the cause? → No (multiple possible factors)
- Is there immediate crisis? → No (not chaotic)
- Can an expert analyze? → Partially (data exists but inconclusive)

Verdict: COMPLEX domain

Response: probe → sense → respond
- Run A/B tests on different theories
- Interview churned users
- Try small interventions, measure results
- Don't bet everything on one analysis
```

**Wrong approach:** Hiring expensive consultant (Complicated response)
**Right approach:** Safe-to-fail experiments (Complex response)
