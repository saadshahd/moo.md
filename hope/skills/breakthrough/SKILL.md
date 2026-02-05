---
name: breakthrough
description: Creative problem-solving techniques when stuck. Use when progress has stalled, solutions feel forced, or conventional approaches have failed. Triggers on "stuck", "blocked", "can't figure out", "hitting a wall".
model: opus
allowed-tools: Read
hooks:
  Stop:
    - hooks:
        - type: prompt
          prompt: "If this breakthrough session found a solution or creative approach, return {\"ok\": false, \"reason\": \"Consider running /hope:learn to capture what unblocked you.\"}. If no breakthrough achieved, return {\"ok\": true}."
---

# breakthrough

Structured creativity when conventional approaches fail.

## When to Use

| Trigger | Action |
|---------|--------|
| "I'm stuck on..." | Run breakthrough |
| "Can't figure out..." | Run breakthrough |
| "Hitting a wall with..." | Run breakthrough |
| "All options seem bad" | Run breakthrough |
| Problem is well-defined | Skip (just execute) |
| Haven't researched yet | Research first |

## Quick Reference: 6 Techniques

| Technique | One-Liner | Best For |
|-----------|-----------|----------|
| [Simplification Cascade](references/techniques.md#1-simplification-cascade) | Strip to essence, solve trivial, add back | Problem feels too big |
| [Scale Game](references/techniques.md#2-scale-game) | 1000x smaller? 1000x larger? | Over-engineered solutions |
| [Meta-Pattern](references/techniques.md#3-meta-pattern-recognition) | What class of problem is this? | "This shouldn't be this hard" |
| [Assumption Inversion](references/techniques.md#4-assumption-inversion) | List assumptions, flip each | All options seem bad |
| [Constraint Removal](references/techniques.md#5-constraint-removal) | Remove constraint, solve, then work within | Stuck on specific constraint |
| [Fresh Perspective](references/techniques.md#6-fresh-perspective) | Explain to duck, draw it, channel expert | Can't see the forest |

## Symptom-Based Dispatch

See [symptoms.md](references/symptoms.md) for full table.

| Symptom | Technique |
|---------|-----------|
| Problem feels overwhelming | Simplification Cascade |
| Solution feels too complex | Scale Game |
| "This shouldn't be this hard" | Meta-Pattern Recognition |
| Every option has fatal flaws | Assumption Inversion |
| One constraint blocking all paths | Constraint Removal |
| Lost in details, can't zoom out | Fresh Perspective |

## Decision Tree

```dot
digraph BreakthroughDecision {
  rankdir=TB
  node [shape=box, style="rounded,filled", fillcolor="#f5f5f5"]

  Start [label="What's the\nprimary symptom?", shape=diamond, fillcolor="#ffe6cc"]

  // Symptoms
  S1 [label="Too big /\noverwhelming", fillcolor="#e6f3ff"]
  S2 [label="Over-engineered /\ntoo complex", fillcolor="#e6f3ff"]
  S3 [label="Wrong framing /\nthis shouldn't be hard", fillcolor="#e6f3ff"]
  S4 [label="All options\nbad", fillcolor="#e6f3ff"]
  S5 [label="Specific constraint\nblocking", fillcolor="#e6f3ff"]
  S6 [label="Can't see clearly /\nlost", fillcolor="#e6f3ff"]

  // Techniques
  T1 [label="Simplification\nCascade", fillcolor="#ccffcc"]
  T2 [label="Scale\nGame", fillcolor="#ccffcc"]
  T3 [label="Meta-Pattern\nRecognition", fillcolor="#ccffcc"]
  T4 [label="Assumption\nInversion", fillcolor="#ccffcc"]
  T5 [label="Constraint\nRemoval", fillcolor="#ccffcc"]
  T6 [label="Fresh\nPerspective", fillcolor="#ccffcc"]

  // Primary routing
  Start -> S1; Start -> S2; Start -> S3
  Start -> S4; Start -> S5; Start -> S6

  S1 -> T1
  S2 -> T2
  S3 -> T3
  S4 -> T4
  S5 -> T5
  S6 -> T6

  // Fallback chains (if still stuck)
  T1 -> T6 [style=dashed, label="fallback"]
  T2 -> T1 [style=dashed, label="fallback"]
  T3 -> T4 [style=dashed, label="fallback"]
  T4 -> T5 [style=dashed, label="fallback"]
  T5 -> T3 [style=dashed, label="fallback"]
  T6 -> T1 [style=dashed, label="fallback"]
}
```

## Protocol

### 1. Name the Stuck

```
SYMPTOM: [What exactly is stuck]
TRIED: [What approaches failed]
CONSTRAINT: [What feels immovable]
```

### 2. Select Technique

Use symptom dispatch table or decision tree.

### 3. Apply Technique

Follow detailed steps in [techniques.md](references/techniques.md).

### 4. Evaluate Result

| Outcome | Action |
|---------|--------|
| New path visible | Proceed with solution |
| Partial clarity | Chain to second technique |
| Still stuck | Try opposite technique |
| Fundamental blocker | Escalate or reframe problem entirely |

### 5. Document Learning

If breakthrough succeeds:

```
PROBLEM: [Original stuck point]
TECHNIQUE: [What worked]
INSIGHT: [What was hidden]
APPLIES TO: [Similar problem class]
```

## Technique Chaining

When single technique insufficient:

| First Try | Chain To | Why |
|-----------|----------|-----|
| Simplification | Scale Game | Found essence, now find right scale |
| Scale Game | Meta-Pattern | Extremes revealed the real problem type |
| Meta-Pattern | Assumption Inversion | Know the class, now challenge its constraints |
| Assumption Inversion | Constraint Removal | Found hidden assumption, now test removing it |
| Constraint Removal | Fresh Perspective | Removed constraint, need new viewpoint |
| Fresh Perspective | Simplification | Got distance, now reduce complexity |

## When NOT to Use

See [when-not-to-use.md](references/when-not-to-use.md).

- Problem is well-defined (just execute)
- Haven't done basic research
- Constraint is truly non-negotiable
- Procrastinating on hard work
- "Stuck" is actually fear of commitment

## Output

```
## Breakthrough Analysis

### Stuck Point
[Symptom + failed approaches]

### Technique Applied
[Name + key steps taken]

### Insight
[What was hidden / blocking]

### Path Forward
[Specific next action]

### Applies To
[Future problems this pattern solves]
```
