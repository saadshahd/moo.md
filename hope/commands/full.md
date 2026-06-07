---
description: Run the complete hope pipeline — session setup, intent, shape, consult, bond
---

# /hope:full

ORCHESTRATE. Run the hope pipeline end-to-end.

**Task:** $0

## Session Setup

Ask: "How would you like to work? Autonomous / Collaborative [default] / Guided?"

Detect session type from the task: Build, Debug, Plan, or Reflect. Emit the marker:

`[SESSION] Pipeline: intent | Engagement: [level]`

## States

`intent | shape | consult | bond | execute | done | abandoned`

The marker's `Pipeline:` value is always exactly one of these — a lookup, never an inference. Re-emit the full marker at every transition.

- **intent** — clarify WHAT. Structured input (proposal, spec, task list) is validated, not re-clarified. Exit: objective + acceptance criteria.
- **shape** — decide HOW. Exit: concrete approach + first step.
- **consult** — expert review pass. Primary stage for Reflect sessions.
- **bond** — decide orchestration. If the task warrants parallel fan-out, author a Workflow. Never agent teams.
- **execute** — do the work with the shaped approach.
- **done / abandoned** — terminals.

## Transitions

Every move is one of these rows. Skips are transitions, not exceptions — the pipeline stays a map, not a rail.

| From | To | When |
| --- | --- | --- |
| intent | shape | objective + criteria clear (Build / Debug / Plan) |
| intent | consult | Reflect — shape skipped, consult is primary |
| intent | execute | trivially clear task — shape skipped |
| shape | consult | second opinion requested |
| shape | bond | parallel fan-out warranted — checkpoint first |
| shape | execute | solo path — bond skipped |
| shape | intent | re-entry: objective gap surfaced |
| consult | shape | re-entry: approach overturned |
| consult | bond | approach holds, fan-out warranted — checkpoint first |
| consult | execute | approach holds, solo |
| consult | done | Reflect — consult was the work |
| bond | execute | workflow authored, or fitness said solo |
| execute | shape | re-entry: approach breaks mid-build |
| execute | done | acceptance criteria met |
| any non-terminal | abandoned | user aborts or task dissolves — say so, never go silent |

**Blocked: intent → bond.** Nothing shaped means nothing to orchestrate. Don't warn — ask the one gate question: "What approach would the workflow execute? Complete shape or state it now."

## Handoffs

At every transition emit three lines, then the updated marker:

- **Closed:** what the finished stage decided (one line)
- **Opens:** what the next stage will resolve
- **You:** what's expected of the user now

`[SESSION] Pipeline: [new state] | Engagement: [level]`

## Pre-bond Checkpoint (Collaborative / Guided)

Before entering bond, quote shape's decided constraint verbatim and ask via AskUserQuestion: "Does this still hold?" Recognition over recall. Autonomous sessions skip this checkpoint — the steer hook still reviews the workflow itself.

## Engagement Levels

- **Autonomous** — minimal check-ins. Proceed unless blocked.
- **Collaborative** — confirm at each handoff. Share reasoning.
- **Guided** — explain each decision. Offer options at every step.

## Plan Mode

Stages produce structured artifacts; execution defers to post-approval.
