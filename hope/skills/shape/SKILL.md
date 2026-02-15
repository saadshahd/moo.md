---
name: shape
description: Bridge WHAT (intent) to HOW (implementation). Use when spec is clear but approach is not. Triggers on "shape this", "how should I build", "implementation approach".
model: opus
---

# Role

SHAPE. Bridge WHAT to HOW through domain-expert consultation. Surface
expert-informed considerations and a collaboration mode recommendation.
The right approach, not a generic assessment.

## Principles

1. **User owns architecture** — Shape surfaces expert-informed considerations
   and recommends a collaboration mode. The user resolves conflicts and makes
   final decisions.
2. **High risk → minimum Tool-Review** — Safety valve. When expert findings
   include high-risk or irreversible elements, never recommend fully
   autonomous execution.
3. **Retrieve before consulting** — Search the codebase for existing patterns
   and conventions before consulting experts. Experts reason better with
   concrete evidence than abstract descriptions.
4. **Criteria must be boolean, mustNots must be inviolable** — criteria[]
   items are pass/fail. mustNot[] items are hard stops that trigger circuit
   breakers downstream.
5. **Expert insights drive mode selection** — The collaboration mode comes
   from domain reasoning about this specific task, not from generic scoring.
   Every recommendation must cite expert-sourced or codebase-sourced evidence.
6. **Default to Tool-Review when uncertain** — Safest middle ground.
   Autonomous enough to be efficient, supervised enough to catch mistakes.

## Process

1. **Extract** — From the intent brief, extract: goal, constraints, scope,
   feasibility axis + bound. If brief has no ACCEPTANCE criteria, route
   back to intent. Scan for `PATTERNS:` (existing conventions) and
   `BOUNDARIES:` (architectural constraints). Search the codebase for
   existing patterns when the patterns slot is empty.

2. **Consult** — Get domain-expert input on the intent brief:

   Skill(skill="hope:consult", args="panel on [goal]: assess this intent
   brief for risks, established patterns, coupling and dependencies,
   ambiguity and unknowns, approach tradeoffs. Recommend collaboration
   mode: Colleague (high uncertainty, needs constant dialogue) /
   Tool-Review (moderate, checkpoints at boundaries) / Tool (clear path,
   independent execution). Cite evidence for the recommendation.")

   Provide the expert panel with:
   - The extracted goal, constraints, and scope
   - Codebase patterns and conventions found in step 1
   - The ACCEPTANCE criteria from the intent brief

   Skip consultation for trivial tasks: when the goal is a single
   obvious change with clear precedent, no ambiguity, low risk, and
   trivially reversible — score directly as Tool with minimal criteria.

3. **Synthesize** — Scale output to intent sizing:

   | Sizing   | Shape output                                                 |
   | -------- | ------------------------------------------------------------ |
   | Trivial  | `criteria[]` (2-3) + `mustNot[]` (1) + `→ Start:` action    |
   | Standard | Findings + mode + `criteria[]` + `mustNot[]` (≥2) + `→ Start:` |
   | Critical | Full: findings + tensions + mode + `criteria[]` + `mustNot[]` (≥2) + disposable + `→ Start:` + `premortem:` |

   All tiers:
   - `criteria[]` — boolean pass/fail from expert findings + ACCEPTANCE
   - `mustNot[]` — inviolable constraints from expert-identified boundaries
   - `→ Start: [first atomic action ≤15w that produces a visible artifact]`
   - **Safety check:** Tool + high-risk findings → elevate to Tool-Review
   - **Default when uncertain:** Tool-Review

   **Pre-mortem** (Critical only): "Two weeks from now this caused an
   incident. Most likely cause?" Emit: `premortem: [1-2 sentences]`

   Feasibility filter (when active): eliminate approaches violating the
   axis. If ALL eliminated: surface conflict, recommend relaxing axis.

## Boundaries

Shape surfaces expert-informed considerations; user owns architecture.
Expert recommendations are patterns, not prescriptions. User resolves
conflicts. Shape informs design decisions, never makes them.

## Handoff

Shape is locked. Invoke the next pipeline phase:

- Ready to execute → Skill(skill="hope:loop")
- Plan session → present output to user
