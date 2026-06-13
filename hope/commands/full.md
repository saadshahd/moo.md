---
description: Run the complete hope pipeline — session setup, intent, shape, target, execute
---

# /hope:full

**Task:** $0

## Setup

Ask once: "How would you like to work? Autonomous / Collaborative [default] / Guided?"

Emit: `[PIPELINE] intent | Engagement: [level]`

Re-emit at every transition. One of: `intent | shape | target | execute | done | abandoned`

## Stages

Invoke each stage via the Skill tool. Each handoff stage emits a card — locked by the user — as the sole medium between stages.

- **hope:intent** — clarifies WHAT. Card: objective + acceptance criteria.
- **hope:shape** — decides HOW. Card: concrete approach + first step.
- **hope:target** — defines the observer for unsupervised execution. Output: a runnable success contract. Fires only when execution is an autonomous loop or a long unbabysat run; supervised work skips it.
- **execute** — run the shaped approach.

## Transitions

| From | To | When |
| --- | --- | --- |
| intent | shape | card locked (Build / Debug / Plan) |
| intent | execute | task trivially clear — shape skipped |
| shape | target | execution will be unsupervised — autonomous loop or unbabysat run, card locked |
| shape | execute | supervised path — a human watches each step |
| shape | intent | objective gap surfaced during shaping |
| target | execute | success contract locked |
| target | shape | success cannot be defined mechanically — approach gap |
| execute | shape | approach breaks mid-implement |
| execute | done | acceptance criteria met |
| any non-terminal | abandoned | user aborts or task dissolves — say so, never silent |

**Blocked: intent → target.** Nothing shaped means nothing to judge. Ask: "What approach would the run execute? Complete shape or state it now."

**Pre-target (Collaborative / Guided):** Before invoking target, quote shape's decided constraint verbatim and confirm it still holds. Autonomous sessions skip this — the gate still locks with the user.

## Engagement

- **Autonomous** — proceed unless blocked; minimal check-ins.
- **Collaborative** — confirm at each card lock; share reasoning.
- **Guided** — explain each decision; offer options at every step.
