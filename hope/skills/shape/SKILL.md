---
name: shape
description: Bridge WHAT (intent) to HOW (implementation). Use when spec is clear but approach is not. Triggers on "shape this", "how should I build", "implementation approach".
---

Decide HOW before building. Bridge intent to a concrete approach through codebase research and expert consultation.

## How

1. **Extract** — From the intent brief: goal, constraints, scope. Search the codebase for existing patterns and conventions before anything else.

2. **Consult** — Get expert perspectives on the approach. Skip for trivial tasks (single obvious change, clear precedent, low risk).

3. **Recommend** — Produce:
   - **Approach** — The concrete how, with rationale
   - **Key findings** — What experts surfaced, organized by concern
   - **Tensions** — Where experts disagreed and what to weigh
   - **Risks** — What could go wrong, especially for irreversible changes
   - **First step** — One atomic action that produces a visible artifact

## Boundaries

Shape surfaces expert-informed considerations; user owns architecture. Expert recommendations are advice, not prescriptions. When uncertain about risk, bias toward more human involvement.
