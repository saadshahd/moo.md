## Context

Post-implementation spec sync. The consult skill was rewritten (`dc6b3f2`) and the spec must catch up. The skill is the source of truth; the spec documents its behavioral contract.

Stack: OpenSpec requirements format (SHALL/MUST + WHEN/THEN scenarios). No runtime code — spec files only.

## Goals

- Align spec with implemented consult behavior
- Capture the 4 behavioral shifts: invisible attribution, interactive output, minimal text, structured workflow

## Non-Goals

- Changing the consult implementation
- Modifying other specs (v4-skill-pipeline, thinking-discipline, team-composition)

## Decisions

1. **Split grounding from attribution.** Grounding (experts reason from documented positions) is still required — it's internal discipline. Attribution (showing expert names to users) is now explicitly forbidden. These are separate requirements because they have opposite visibility: one is mandatory-internal, the other is prohibited-external.

2. **Interactive presentation as its own requirement.** The Minto pyramid AskUserQuestion format governs the entire output structure — label/description/detail-panel constraints, forbidden headers, "Go deeper" option. Too much for a scenario; warrants a full requirement with multiple scenarios.

3. **Minimal text discipline separate from presentation.** Presentation defines what goes inside AskUserQuestion. Text discipline defines what goes around it (one bold sentence before, one after). Different enforcement points.

4. **Workflow as a requirement, not just documentation.** The Route/Reason/Present/Land cycle with loop-back is a behavioral contract — Reason produces no output, Land supports 4 continuations. These are testable behaviors, not implementation notes.

## Risks

- **Spec divergence over time.** The interactive presentation rules are detailed (max 10 lines, ~40 chars, specific forbidden headers). If the skill evolves, the spec may lag. Mitigation: keep scenarios focused on outcomes, not pixel counts.
