---
name: consult
description: Use when facing design tradeoffs, architecture decisions, repeated failure modes, or domain questions where multiple perspectives would reduce decision regret. Triggers on: expert names, "panel", "debate", "what would [X] say", "stuck on", style requests.
---

Simulate expert perspectives by reasoning from documented positions to the user's context. Productive disagreement over comfortable consensus.

## Principles

- Ground every claim in documented work — this is internal discipline.
- If selected experts all agree easily, the wrong experts were selected.
- Land on one actionable recommendation. Debate without a next step is noise.
- By concern, not by expert — group findings around decisions the user faces.

## Presentation

These rules govern how consult communicates across all goals.

- **Experts are invisible in findings** — In Step 5/6 output, expert names, sources, and attribution never appear. Not in text, labels, descriptions, or detail panels. Never "Fowler says" or "Hickey argues." The user sees suggestions and why they matter. **Sole exception:** goal-pick (Step 2) and confirm (Step 3) show candidate names so the user can shape the panel — names never cross into findings.
- **Minimal text between prompts** — Before the AskUserQuestion: one bold sentence framing the core diagnosis or reframe. After the user answers: one bold sentence with the next step. Nothing else. Use markdown **bold** for the key insight. No paragraphs, no per-expert reasoning, no multi-line explanations.

## Goals

The user picks a goal; the goal projects a panel from the routed pool. One row per goal — lookup, never inference:

| Goal | Count | Diversity | Mode |
|------|-------|-----------|------|
| depth-novelty | 2-3 | same + adjacent domain | panel |
| coverage | 3-4 | cross-domain | review |
| unblock | 2-3 | cross-lens | unblock |
| validate | 3-4 | cross-domain | refute |

`Mode` shapes the reasoning instruction in Step 4 — `refute` means experts attack the user's chosen position to find where it breaks, not survey alternatives. `Count`/`Diversity` shape the projection and render in the goal-pick preview.

## Workflow

### Step 1: Route the pool

Domain-match the question into a pool — over-fetch to ~6-8 candidates so every goal has reshuffle slack. The pool is a fact about the question: fixed once, re-routed only if the question changes. No text output — go straight to Step 2.

- Match using the domain map below
- Max 2 from same domain row — diversity requires crossing domains
- Collect absolute profile paths — Step 4's agents read them, never the main conversation
- No domain match → tell the user no profile covers the question, then offer an in-weights panel: relevant experts simulated purely from model knowledge. If accepted, run the same workflow with expert names in place of profile paths.

### Step 2: Pick goal

One AskUserQuestion: the 4 goals as options. Each goal's detail panel previews the panel it would project from the pool — `Count`, `Diversity`, and the **candidate expert names**.

Projection: apply the goal's `Count` + `Diversity` to the pool → candidate panel.

### Step 3: Confirm panel

Show the projected panel via AskUserQuestion (names visible). Three options, each one predictable action — never a single ambiguous "regenerate":

- **Accept** — proceed to Step 4
- **Reshuffle within pool** — re-project from the unused pool candidates (over-fetch guarantees `pool > count`)
- **Change goal** — re-enter Step 2

No per-expert editing.

### Step 4: Reason

Fan out one Agent per profile, all launched in a single message so they run in parallel.

Each agent's prompt: read the profile at its absolute path; simulate the expert by arguing from documented positions applied to the question, respecting the "Would NEVER Say" guardrails; for living figures prefer newer model knowledge past the `Verified:` date; apply the goal's `Mode`. Return at most 3 concerns — each one line per field: concern, suggestion, why, gain, pay — plus one `dissent` line stating where this expert pushes back against the likely consensus. Terse, no preamble; the response is data for synthesis, not prose.

Distill returned positions into anonymous suggestions — tensions between experts (compare dissent lines) are the valuable output. No text output — go straight to Step 5.

### Step 5: Present

Present one AskUserQuestion (framing per Presentation rules). Concerns as options.

**For each concern (max 10 lines per detail panel):**
- Label: the suggestion (conclusion first)
- Description: why it matters (one line)
- Detail panel — plain text in the monospace preview box; markdown renders literally. ONLY these sections, ~40 chars per line:

```
WHY IT MATTERS:
  - [how this affects your work]
  - [cost of ignoring it]

TRADEOFF:
  Gain: [what you get]
  Pay: [what it costs]
```

The label already states the suggestion. The description already states why it matters. The detail panel goes one level deeper — it does not repeat the label or restate the suggestion.

Forbidden in detail panels: POSITIONS, TENSION, CONCERN headers. These sections bloat panels and hide content behind scroll.

Always include a "Go deeper" option (no detail panel needed).

### Step 6: Land

After the user selects (framing per Presentation rules):

- **Satisfied** — Done. No recap.
- **Go deeper** — Return to Step 4 with narrower focus. Present via AskUserQuestion again.
- **Different perspective** — Return to Step 3 to reshuffle or change goal, then re-reason.
- **Challenge** — Counterargument via AskUserQuestion.

## Domain Map

Profiles live in `profiles/`. Route by domain:

| Domain | Profiles |
|--------|----------|
| React / Frontend / TS / JS | abramov, osmani, perry, wathan, vergnaud, simpson |
| Go / Systems | pike |
| Distributed Systems | lamport, kleppmann |
| Python | hettinger |
| Performance | gregg, osmani |
| Architecture / TDD / DDD | fowler, martin, alexander, feathers, beck, freeman, evans, newman, vernon |
| DevOps / Observability | hightower, majors, humble |
| REST / APIs | fielding |
| Product / Design / Leadership | cagan, jobs, norman, frost, zhuo |
| Startups | graham |
| Accessibility | soueidan |
| FP / Simplicity | hickey, milewski |
| State Machines | khorshid |
| AI / LLMs | willison |
| Tools for Thought | matuschak, appleton, victor, case, papert, kay, inkandswitch, brander, litt, kleppmann |
| Decisions / Behavior | kahneman, klein, fogg, norman |
| Systems Thinking | meadows, deming, snowden |
| Strategy | boyd, goldratt, rumelt |
| Communication | tufte, orwell, minto |
| Legibility / Emergent Order | geertz, jacobs, scott |
| Incentives / Metrics / Commons | goodhart, ostrom, simon |
| Epistemology / Language | popper, kuhn, wittgenstein |
| Organizational Failure / Safety | perrow, vaughan, reason |
| Evolution / Complexity | kauffman, dawkins |
| Learning | vygotsky, bruner |
| Security | schneier, shostack |

## Boundaries

Consult advises — it does not execute or decide. The caller owns the decision; expert perspectives are suggestions, not prescriptions.
