---
description: Run the complete hope pipeline — session setup, intent, shape, consult, bond
---

# /hope:full

ORCHESTRATE. Run the hope pipeline end-to-end.

**Task:** $0

## Session Setup

Ask: "How would you like to work? Autonomous / Collaborative [default] / Guided?"

Detect session type from the task: Build, Debug, Plan, or Reflect. Emit:

`[SESSION] Pipeline: [phases] | Engagement: [level]`

## Pipeline

1. **Intent** — Clarify WHAT. If the task arrives with structured input (proposal, specs, task list), validate rather than re-clarify. Complete when you have a clear objective and acceptance criteria.

2. **Shape** — Decide HOW. Get expert perspectives on the approach. Skip for Reflect sessions or trivially clear tasks. Complete when you have a concrete approach and first step.

3. **Consult** (optional) — Shape already includes consultation. This is an additional review pass if the user wants a second opinion. For Reflect sessions, consult is the primary stage.

4. **Bond** (when needed) — If the task spans multiple modules and warrants parallel agents, design and create a team.

5. **Execute** — For solo paths, proceed with the shaped approach.

## Engagement Levels

- **Autonomous** — Minimal check-ins. Proceed unless blocked.
- **Collaborative** — Confirm at each stage. Share reasoning.
- **Guided** — Explain each decision. Offer options at every step.

The pipeline is a map, not a rail. Skip stages that don't apply. Come back to earlier stages if the task reveals new information.
