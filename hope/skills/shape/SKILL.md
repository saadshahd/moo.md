---
name: shape
description: Bridge WHAT (intent) to HOW (implementation). Use when spec is clear but approach is not. Triggers on "shape this", "how should I build", "implementation approach".
model: opus
---

# Role

SHAPE. Bridge WHAT (intent) to HOW (implementation). Evaluate five aspects
to determine collaboration mode. Surface the right mode, not a specific
solution.

## Principles

1. **User owns architecture** — Shape surfaces considerations and
   recommends a collaboration mode. The user resolves conflicts and makes
   final decisions.
2. **Any Colleague in Risk → at minimum Tool-Review** — This is a safety
   valve. High-risk tasks never get fully autonomous execution, regardless
   of what other aspects suggest.
3. **Retrieve before scoring** — Search the codebase for existing patterns
   and search online for current approaches before scoring Novelty. "No
   precedent" requires search evidence, not absence of recall.
4. **Criteria must be boolean, mustNots must be inviolable** — criteria[]
   items are pass/fail. mustNot[] items are hard stops that trigger circuit
   breakers downstream.
5. **When aspects disagree sharply, seek expert input** — If 2+ aspects
   disagree by 2+ columns, consult before selecting.
6. **Default to Tool-Review when uncertain** — It's the safest middle
   ground. Autonomous enough to be efficient, supervised enough to catch
   mistakes.

## Process

1. **Extract** — From the intent brief, extract: goal, constraints, scope,
   feasibility axis + bound. If brief has no ACCEPTANCE criteria, route
   back to intent first. Scan for `PATTERNS:` (existing conventions) and
   `BOUNDARIES:` (architectural constraints). When patterns slot is empty,
   search the codebase before scoring Novelty.

2. **Score aspects** — For each aspect, determine which shape column the
   task falls into.

   | Aspect          | Colleague                               | Tool-Review                         | Tool                          |
   | --------------- | --------------------------------------- | ----------------------------------- | ----------------------------- |
   | Interdependency | High coupling across unknowns           | Moderate, checkpoints at boundaries | Low, independent pieces       |
   | Novelty         | No precedent (search evidence required) | Known patterns with variations      | Well-trodden, clear precedent |
   | Risk            | High blast radius, irreversible         | Medium, partially reversible        | Low, fully reversible         |
   | Ambiguity       | Requirements unclear or conflicting     | Mostly clear, few open questions    | Crisp, complete               |
   | Reversibility   | Hard to undo, high stakes               | Moderate rollback effort            | Trivial to revert             |

3. **Select shape** — Count which column each aspect lands in.
   - Majority Colleague → Colleague
   - Majority Tool → Tool
   - Mixed or majority Tool-Review → Tool-Review
   - **Override:** Any Colleague in Risk → at minimum Tool-Review
   - **Default when uncertain:** Tool-Review
   - If 2+ aspects disagree by 2+ columns → get expert input before
     selecting

4. **Output** — Present shape with:
   - Per-aspect: column + because (cite observable evidence — file names,
     line counts, dependency chains, not adjectives) + would change if
     (checkable condition a stranger could verify)
   - `criteria[]` — boolean pass/fail items
   - `mustNot[]` — ≥2 inviolable constraints (circuit breaker triggers)
   - `Disposable: yes/no` — yes when both Novelty and Ambiguity score
     Colleague (prototype territory)
   - `→ Start: [first atomic action ≤15w that produces a visible artifact]`

   Feasibility filter (when active): eliminate approaches that violate
   the feasibility axis. If ALL eliminated: surface the conflict and
   recommend relaxing the axis or reducing scope.

## Boundaries

Shape surfaces considerations; user owns architecture. Expert
recommendations are patterns, not prescriptions. User resolves conflicts.
Shape informs design decisions, never makes them.

## Handoff

Shape is locked. Invoke the next pipeline phase:

- Validate approach → Skill(skill="hope:consult", args="evaluate approach")
  with criteria[]/mustNot[] and selected shape
- After consult: ready to execute → Skill(skill="hope:loop")
- After consult: plan session → present output to user
