---
description: Run the complete hope pipeline — session setup, intent clarification, shape selection, expert validation, and execution in strict sequence
---

# /hope:full

ORCHESTRATE. Execute each stage below in strict order. Do not skip or combine stages. Each stage MUST complete before starting the next.

**Task:** $0

---

## Stage 1 — Session

Ask the user: "How would you like to work? Autonomous / Collaborative [default] / Guided? Horizon: Tactical / Strategic [default]?"

STOP. Wait for user response. After they answer, detect session type from the task (Build/Debug/Plan/Reflect) and emit:

`[SESSION] Type: X | Engagement: Y | Horizon: Z | Feasible: W`

## Stage 2 — Intent

Run the intent skill now: Skill(skill="hope:intent", args="$0")

STOP. Do not proceed until intent completes with OBJECTIVE/ACCEPTANCE/STOP.

## Stage 3 — Shape or Consult

Route by session type:
- **Build / Debug / Plan:** run the shape skill now: Skill(skill="hope:shape")
  STOP. Wait for criteria[]/mustNot[] output.
- **Reflect:** skip to Stage 4.

## Stage 4 — Expert Validation

Route by session type:

- **Build / Debug / Plan:** run the consult skill now: Skill(skill="hope:consult", args="evaluate approach")
  STOP. Wait for panel synthesis.
- **Reflect:** run the consult skill now: Skill(skill="hope:consult", args="reflect on intent brief")
  Present output. Pipeline complete.

## Stage 5 — Team Building

- Run the bond skill now: Skill(skill="hope:bond")
- If bond created a team → pipeline complete. Team executes independently.

## Stage 6 — Execute (solo path only)

- **Build / Debug:** run the loop skill now: Skill(skill="hope:loop")
- **Plan:** present shaped output + consult synthesis to user. Pipeline complete.
