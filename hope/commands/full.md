---
description: Run the complete hope pipeline — session setup, intent, shape, consult, bond
---

# /hope:full

**Task:** $0

## Setup

Ask once: "How would you like to work? Autonomous / Collaborative [default] / Guided?"

Emit: `[PIPELINE] intent | Engagement: [level]`

Re-emit at every transition. One of: `intent | shape | bond | execute | done | abandoned`

## Stages

Invoke each stage via the Skill tool. Every stage emits a card. The card — locked by the user — is the sole handoff medium between stages.

- **hope:intent** — clarifies WHAT. Card: objective + acceptance criteria.
- **hope:shape** — decides HOW. Card: concrete approach + first step.
- **hope:bond** — decides orchestration. Card: workflow or solo ruling. Requires a shaped card.
- **implement** — execute with the shaped approach.

## Transitions

| From | To | When |
| --- | --- | --- |
| intent | shape | card locked (Build / Debug / Plan) |
| intent | execute | task trivially clear — shape skipped |
| shape | bond | parallel fan-out warranted, card locked |
| shape | execute | solo path |
| shape | intent | objective gap surfaced during shaping |
| bond | execute | workflow authored or fitness ruled solo |
| execute | shape | approach breaks mid-implement |
| execute | done | acceptance criteria met |
| any non-terminal | abandoned | user aborts or task dissolves — say so, never silent |

**Blocked: intent → bond.** Nothing shaped means nothing to orchestrate. Ask: "What approach would the workflow execute? Complete shape or state it now."

**Pre-bond (Collaborative / Guided):** Before invoking bond, quote shape's decided constraint verbatim and confirm it still holds. Autonomous sessions skip this — the steer hook still reviews the workflow.

## Engagement

- **Autonomous** — proceed unless blocked; minimal check-ins.
- **Collaborative** — confirm at each card lock; share reasoning.
- **Guided** — explain each decision; offer options at every step.
