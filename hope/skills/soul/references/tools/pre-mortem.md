# Pre-Mortem Analysis

Imagine the project has already failed. Work backward to identify why.

---

## When to Use

- Before starting significant projects
- During planning phases
- When stakes are high
- Before major architectural decisions
- Launch planning

---

## The Framework

### Setup

"It's 6 months from now. The project has failed spectacularly."

### Process

1. **Prime the failure**: State clearly that the project has failed
2. **Silent generation**: Each person writes reasons for failure (2-3 min, no discussion)
3. **Round-robin share**: Go around, one reason per person, no debate
4. **Aggregate**: Group similar failure modes
5. **Prioritize**: Rank by probability × impact
6. **Mitigate**: Address top 3-5 in the plan

### Output Template

```
## Pre-Mortem: [Project Name]

### Failure Modes Identified
1. [Mode]: Probability [H/M/L], Impact [H/M/L]
2. [Mode]: Probability [H/M/L], Impact [H/M/L]
3. [Mode]: Probability [H/M/L], Impact [H/M/L]

### Mitigations Added to Plan
- [Mitigation 1]
- [Mitigation 2]
```

---

## Why It Works

- **Prospective hindsight**: Imagining an event has occurred increases prediction accuracy by 30%
- **Breaks groupthink**: Makes dissent safe and expected
- **Surfaces hidden concerns**: People share worries they'd normally suppress
- **Reduces overconfidence**: Counters planning fallacy

---

## vs Post-Mortem

| Pre-Mortem         | Post-Mortem                          |
| ------------------ | ------------------------------------ |
| Before failure     | After failure                        |
| Imagined scenarios | Actual events                        |
| Preventive         | Reactive                             |
| Low cost           | High cost (failure already happened) |

---

## Anti-Patterns

- **Too vague**: "It might not work" isn't useful. Be specific.
- **Blame-oriented**: Focus on scenarios, not people
- **Ignored output**: If you don't change the plan, why bother?

---

## Practice Failure

Pre-mortem identifies failures. Practice failure builds muscle memory for response.

**Why practice?** Pilots practice stalls and spins before real emergencies. "A slow response from seldom having accomplished the acts" is preventable.

**How to practice:**

1. **Identify critical failure modes** from pre-mortem
2. **Simulate the scenario** in controlled environment
   - Inject database failure in staging
   - Run deployment rollback drill
   - Practice incident response with mock pages
3. **Time-box the drill** (30 min max)
4. **Debrief**: What worked? What fumbled?
5. **Repeat** until response is automatic

**Practice scenarios by role:**

| Role      | Practice Drill                          |
| --------- | --------------------------------------- |
| Developer | Rollback deployment under time pressure |
| On-call   | Triage ambiguous alerts                 |
| Team lead | Communicate outage to stakeholders      |

**Key insight**: Pre-mortem without practice = knowing what could go wrong. Pre-mortem WITH practice = knowing what to do when it does.

---

## Provenance

Gary Klein, 2007. Published in Harvard Business Review. Based on Mitchell, Russo & Pennington's 1989 research on prospective hindsight. Klein found pre-mortems reduced overconfidence more than any other critiquing technique.
