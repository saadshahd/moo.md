---
name: consult
description: Use when you want to learn how experts would think about a design tradeoff, architecture choice, repeated failure, or domain question. Triggers on expert names, "mentor", "panel", "debate", "what would [X] say", "stuck on", style requests.
---

Surface expert knowledge — names, reasoning, and the tensions between them visible — so the user can learn and decide for themselves.

## Principles

- Ground every claim in documented work — this is internal discipline.
- Show the reasoning, not just the verdict. The user should see HOW each expert gets there, in their voice.
- Never converge for the user. Do not land on "the one recommendation" — surface positions and let the tension stand.
- Tensions between experts are the payload. If everyone agrees easily, the wrong experts were selected.

## Modes

Two modes. MENTOR leads — the un-forced default. PANEL is opt-in.

| Mode | Breadth | Shape |
|------|---------|-------|
| MENTOR | one lens, deep | a single expert reasons through the question in their own voice |
| PANEL | multi-perspective | 2-4 experts, each reasoning visibly; the tensions between them are the point |

**Refute is an orthogonal opt-in flag, never a mode and never the default.** When the user asks to be challenged, experts attack the chosen position to find where it breaks instead of surveying alternatives. Available on either mode; off unless the user turns it on.

## Goals (PANEL only)

In PANEL, an optional goal tunes only how many experts and how diverse — nothing more. No goal forces a reasoning posture or pushes toward one answer.

| Goal | Count | Diversity |
|------|-------|-----------|
| depth-novelty | 2-3 | same + adjacent domain |
| coverage | 3-4 | cross-domain |
| unblock | 2-3 | cross-lens |

Default: depth-novelty. Goal selection is optional — skip it and the default stands. (To challenge a position, turn on the refute flag; it is not a goal.)

## Presentation

These rules govern how consult communicates.

- **Experts are visible** — names, sources, and attribution appear throughout findings. "Fowler argues...", "Hickey would push back...". The user learns who thinks what and why.
- **Show the reasoning** — present each expert's actual argument as readable attributed prose between prompts, not a one-line verdict. Keep it scannable (short paragraphs, one expert per block), but never strip the reasoning down to a label.
- **Surface tensions explicitly** — where experts disagree, name the disagreement and both sides.

## Workflow

### Step 1: Route the pool

Domain-match the question into a pool — over-fetch to ~6-8 candidates so any mode has reshuffle slack. The pool is a fact about the question: fixed once, re-routed only if the question changes. No text output — go straight to Step 2.

- Match using the domain map below
- Max 2 from same domain row — diversity requires crossing domains
- Collect absolute profile paths — Step 3's agents read them, never the main conversation
- No domain match → tell the user no profile covers the question, then offer an in-weights panel: relevant experts simulated purely from model knowledge. If accepted, run the same workflow with expert names in place of profile paths.

### Step 2: Pick mode

One AskUserQuestion. Options: **MENTOR** (recommended — one expert, deep) and **PANEL** (multi-perspective). Each option's detail panel shows the candidate expert name(s) it would draw from the pool, so the user shapes the lens. Include refute as a selectable add-on in the prompt (off by default).

- MENTOR projects the single best-fit lens from the pool.
- PANEL projects a panel using the chosen goal's `Count` + `Diversity` (default depth-novelty).
- After the user picks, confirm the expert(s) by name with one of: **Accept**, **Reshuffle** (re-project from unused pool candidates), **Switch mode/goal**.

### Step 3: Reason

Fan out one Agent per selected expert, all launched in a single message so they run in parallel.

Each agent's prompt: read the profile at its absolute path; reason through the question from documented positions applied to the user's context, respecting the "Would NEVER Say" guardrails; for living figures prefer newer model knowledge past the `Verified:` date; if the refute flag is on, attack the user's position to find where it breaks. Return the expert's actual argument — a few sentences of reasoning the user can learn from — plus, for PANEL, one `dissent` line stating where this expert pushes back against the likely consensus. Attribution is preserved, not stripped — names stay attached.

### Step 4: Present

Present each expert's reasoning as attributed prose (Presentation rules). MENTOR: one expert's argument, in depth. PANEL: each expert's position, then the tensions between them named explicitly.

Close with one AskUserQuestion for direction — never a forced recommendation:

- **Go deeper** — narrow the lens, re-reason (Step 3)
- **Different perspective** — reshuffle or switch mode/goal (Step 2)
- **Challenge it** — turn on the refute flag and re-reason
- **Done** — no recap

## Domain Map

Profiles live in `profiles/`. Route by domain:

| Domain | Profiles |
|--------|----------|
| React / State | abramov |
| CSS / Styling | wathan |
| Design Systems | frost |
| Web Animation | perry |
| TypeScript (type-level) | vergnaud |
| JavaScript | simpson, osmani |
| Go / Systems | pike, cox |
| Distributed Systems | lamport, kleppmann, helland |
| Formal Methods / Verification | lamport, kleppmann |
| Concurrency | pike, armstrong, lamport |
| Python | hettinger |
| Performance | gregg, osmani, muratori |
| Architecture / Patterns | fowler, martin, alexander |
| TDD / Testing | beck, freeman, hughes |
| DDD | evans, vernon |
| Event Sourcing / CQRS | young |
| Legacy / Refactoring | feathers, fowler |
| Microservices | newman |
| Rails / Monolith | dhh |
| DevOps / Observability | hightower, majors, humble, forsgren |
| REST / HTTP | fielding |
| API / Library Design | bloch |
| Product Management | cagan, jobs |
| UX / Design Psychology | norman |
| Design Leadership | zhuo |
| Startups | graham, dhh |
| Databases / Data Evolution | pavlo, helland, sadalage, young, kleppmann |
| Reliability / Stability | nygard, armstrong, cook |
| Team / Org Design | skelton-pais, forsgren, zhuo |
| Accessibility | soueidan |
| Simplicity / Data-Oriented | hickey |
| Category Theory / FP | milewski |
| FP in JS (pragmatic) | simpson |
| State Machines | khorshid |
| AI / LLMs | willison, karpathy, huyen, cherny, osmani |
| Note Systems / Memory | matuschak |
| Interactive Explanation | victor, case |
| Malleable / End-User SW | inkandswitch, litt, kleppmann |
| Knowledge Gardens | appleton, brander |
| Computing Visionaries | kay, papert |
| Decisions / Behavior | kahneman, klein, fogg, norman, simon |
| Systems Thinking | meadows, deming, snowden |
| Quality / Management | deming |
| Strategy | boyd, rumelt, goldratt |
| Constraints / Flow | goldratt |
| Communication | tufte, orwell, minto, jobs |
| Legibility / Emergent Order | geertz, jacobs, scott |
| Incentives / Metrics / Commons | goodhart, ostrom |
| Epistemology / Language | popper, kuhn, wittgenstein |
| Organizational Failure / Safety | perrow, vaughan, reason, cook |
| Evolution / Complexity | kauffman, dawkins |
| Learning | vygotsky, bruner |
| Security | schneier, shostack |

## Boundaries

Consult surfaces knowledge — it does not execute or decide. The caller owns the decision; expert perspectives are understanding to learn from, not prescriptions to follow.
