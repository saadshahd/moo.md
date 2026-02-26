---
description: Run the complete hope pipeline — session setup, intent, shape, consult, loop, and verify in strict sequence
---

# /hope:full

ORCHESTRATE. Execute each stage below in strict order. Do not skip or combine stages. Each stage MUST complete before starting the next.

**Plan mode?** Pipeline still runs — stages produce structured artifacts
(OBJECTIVE, criteria[], mustNot[]) in conversation. The plan file captures
the execution protocol. Stages 6-7 defer to post-approval.

**Task:** $0

---

## Stage 1 — Session

Ask the user: "How would you like to work? Autonomous / Collaborative [default] / Guided? Horizon: Tactical / Strategic [default]?"

STOP. Wait for user response. After they answer, detect session type from the task (Build/Debug/Plan/Reflect), assess cognitive zone, and emit:

`[SESSION] Pipeline: [phases] | Engagement: [level] | Horizon: [horizon] | Feasible: [axis] ([bound]) | Zone: [1-3] ([dimension])`

## Stage 2 — Intent

If task already has structured spec (proposal, design, tasks, OBJECTIVE):
pass to intent for validation, not re-clarification.

Run the intent skill now: Skill(skill="hope:intent", args="$0")

Complete when assistant output contains: `OBJECTIVE:` + `ACCEPTANCE` bullets.

## Stage 3 — Shape or Consult

Route by session type:
- **Build / Debug / Plan:** run the shape skill now: Skill(skill="hope:shape")
  Complete when assistant output contains: `criteria[]` + `mustNot[]`.
- **Reflect:** skip to Stage 4.

## Stage 4 — Expert Validation (optional)

Shape already includes domain-expert consultation. This stage is an optional
second-opinion review pass.

Route by session type:

- **Build / Debug / Plan:** ask the user if they want additional expert
  validation. If yes: Skill(skill="hope:consult", args="review shaped approach against spec")
  STOP. Wait for review findings.
- **Reflect:** run the consult skill now: Skill(skill="hope:consult", args="reflect on intent brief")
  Present output. Pipeline complete.

## Stage 5 — Team Building

- Run the bond skill now: Skill(skill="hope:bond")
- Complete when: bond blueprint approved or solo path confirmed.
- If bond created a team → pipeline complete. Team executes independently.

## Execution Readiness

For Build / Debug sessions building web apps:
- If portless services or d3k monitoring are active, start monitored dev: Skill(skill="kit:watch")
- Include Skill(skill="kit:browser") in verification steps
- For team paths: embed these skill invocations in teammate prompts

## Stage 6 — Execute (solo path only)

- **Build / Debug:** run the loop skill now: Skill(skill="hope:loop")
- **Plan:** present shaped output + consult synthesis to user. Pipeline complete.

## Stage 7 — Verify (Build / Debug only)

After loop completes, run pre-PR verification:

Skill(skill="hope:verify")

STOP. Wait for verification card. 4 parallel specialists assess
external quality: correctness, security, performance, standards.

Complete when verification card emitted. Gate decision determines next step:
- **SHIP** → create PR
- **FIX** → user reviews warnings, then PR
- **BLOCK** → fix blockers (re-enter loop if needed), then re-verify
