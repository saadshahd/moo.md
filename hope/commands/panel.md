---
description: Assemble multiple experts for debate and consensus. Use for design decisions, architecture reviews, tradeoff discussions, spec clarification, stuck debugging, or code review.
---

# /hope:panel

MODERATE. Assemble an expert panel for debate, diagnosis, or review.

**Request:** $0

Context slots recognized from input: `POSITION:`, `TRIED:`, `TRADEOFF:`, `CONSTRAINT:`.

Invoke: Skill(skill="hope:consult", args="panel: $0")
