# SPOT

Deliberately surface, classify, and act on recurring patterns.

## When to Use

| Trigger | Use This Framework |
|---------|-------------------|
| Same problem keeps reappearing | Find the underlying pattern |
| Retrospectives and postmortems | Extract actionable patterns |
| Process improvement efforts | Systematic pattern-to-intervention |

## The Framework

```
    ┌─────────────────────────────────────────────────────┐
    │                     SPOT                            │
    │        Pattern Recognition → Action                 │
    └─────────────────────────────────────────────────────┘

    ┌─────────────┐
    │ S-SURFACE   │  What's recurring? What feels familiar?
    │             │
    │ Discover    │  ─▶ "I've seen this before..."
    │ patterns    │      "This keeps happening..."
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ P-PATTERN   │  Is this temporal, structural,
    │   TYPE      │  behavioral, or causal?
    │             │
    │ Classify    │  ─▶ Which pattern type?
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ O-OPERATE   │  What intervention matches
    │             │  this pattern type?
    │ Intervene   │
    │             │  ─▶ Pattern-specific action
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ T-TRACK     │  Did intervention work?
    │             │  Is pattern shifting?
    │ Monitor     │
    │             │  ─▶ Feedback loop
    └─────────────┘
```

## Pattern Types

| Type | Signature | Example | Intervention Class |
|------|-----------|---------|-------------------|
| **Temporal** | Same time, same problem | "Every Monday..." "End of quarter..." | Scheduling, preparation |
| **Structural** | Same architecture, same failure | "Every time we add a service..." | Design patterns, guardrails |
| **Behavioral** | Same person/team, same dynamic | "When X is involved..." | Training, process, roles |
| **Causal** | Same trigger, same cascade | "Whenever we deploy on Friday..." | Root cause, prevention |

## How to Apply

### S - Surface

Ask discovery questions:
- "When have I seen something like this before?"
- "What does this remind me of?"
- "Is this a one-off or a trend?"
- "Who else has noticed this?"

**Output:** A candidate pattern to investigate.

### P - Pattern-type

Classify what you found:

```
TEMPORAL PATTERN?
─────────────────────────────────────────────────
□ Does it happen at predictable times?
□ Is there a rhythm (daily, weekly, quarterly)?
□ Do external events (releases, reviews) trigger it?

STRUCTURAL PATTERN?
─────────────────────────────────────────────────
□ Does it happen in similar technical contexts?
□ Is there an architectural weakness?
□ Do similar components fail similarly?

BEHAVIORAL PATTERN?
─────────────────────────────────────────────────
□ Is it tied to specific people or teams?
□ Does it happen in certain meeting types?
□ Is there a cultural or incentive driver?

CAUSAL PATTERN?
─────────────────────────────────────────────────
□ Is there a clear trigger → effect chain?
□ Does A always lead to B?
□ Is this the symptom or the cause?
```

### O - Operationalize

Match intervention to pattern type:

| Pattern Type | Intervention Strategy |
|--------------|----------------------|
| **Temporal** | Pre-schedule prevention, buffer time, move timing |
| **Structural** | Design patterns, architectural guardrails, abstractions |
| **Behavioral** | Training, process changes, role clarity, incentive alignment |
| **Causal** | Root cause elimination, circuit breakers, monitoring |

### T - Track

Set up feedback loop:
- What metric signals the pattern?
- When will we check if intervention worked?
- What's the success threshold?
- If pattern persists, what's plan B?

## Example

**Topic:** Production incidents after deployments

```
S - SURFACE
─────────────────────────────────────────────────
Pattern candidate: "We keep having incidents after
deploys, especially late in the week."

Evidence:
- 3 Friday incidents this quarter
- All were post-deploy
- Similar symptoms: latency spike → timeout cascade

P - PATTERN-TYPE
─────────────────────────────────────────────────
☑ Temporal: Friday deploys
☑ Causal: Deploy → latency → cascade
☐ Structural: (different services each time)
☐ Behavioral: (different engineers)

Classification: TEMPORAL + CAUSAL

O - OPERATIONALIZE
─────────────────────────────────────────────────
For Temporal: No deploys after Thursday noon
For Causal:
  - Add latency budget checks to deploy pipeline
  - Auto-rollback if p99 > threshold
  - Page on-call BEFORE cascade, not after

T - TRACK
─────────────────────────────────────────────────
Metric: Friday deploy incidents
Current: 3/quarter
Target: 0/quarter
Check: Next quarter retro
Plan B: If still happening → Friday deploy freeze
```

## Anti-Patterns

| Mistake | Result | Prevention |
|---------|--------|------------|
| Pattern apophenia | Seeing patterns that aren't there | Require 3+ instances |
| Single-type classification | Miss compound patterns | Check all 4 types |
| Generic intervention | Doesn't match pattern | Type → intervention mapping |
| No tracking | Can't tell if it worked | Explicit metrics in T |

## Key Insight

Patterns are only useful if they lead to action. Recognition without intervention is just complaint. SPOT forces the connection: every pattern gets typed, every type gets an intervention, every intervention gets tracked.

---

*Composite: pattern classification + retrospective techniques*
