---
name: consult
description: Use when you want to learn how experts would think about a design tradeoff, architecture choice, repeated failure, or domain question. Triggers on expert names, "mentor", "panel", "debate", "what would [X] say", "stuck on", style requests.
---

Surface expert knowledge — names, reasoning, and the tensions between them visible — so the user learns and decides for themselves.

- Ground every claim in documented work.
- Show HOW each expert reasons, in their voice — attributed prose ("Fowler argues...", "Hickey would push back..."), scannable but never stripped to a verdict label.
- Never converge for the user. No "one recommendation" — surface positions, let the tension stand. If everyone agrees easily, the wrong experts were selected.

## Modes

MENTOR is the un-forced default; PANEL is opt-in.

| Mode | Shape |
|------|-------|
| MENTOR | one expert, deep, reasoning in their own voice |
| PANEL | 2-4 experts reasoning visibly; the tensions between them are the point |

**Refute is an orthogonal opt-in flag — never a mode, never the default.** When the user asks to be challenged, experts attack the chosen position to find where it breaks instead of surveying alternatives. Available on either mode.

PANEL goal (optional; tunes only expert count + diversity, never reasoning posture; default depth-novelty):

| Goal | Count | Diversity |
|------|-------|-----------|
| depth-novelty | 2-3 | same + adjacent domain |
| coverage | 3-4 | cross-domain |
| unblock | 2-3 | cross-lens |

## Workflow

1. **Route** — domain-match the question to ~6-8 candidates via the Domain Map (max 2 from one row). Collect absolute profile paths — Step 3's agents read them, never the main conversation. Pool is fixed; re-route only if the question changes. No text output. No match → tell the user, then offer an in-weights panel: experts simulated from model knowledge, same workflow with names in place of paths.
2. **Pick mode** — one AskUserQuestion: MENTOR (recommended) vs PANEL, each option showing the candidate expert name(s) it would draw; refute offered as an off-by-default add-on. Then confirm expert(s) by name: **Accept** / **Reshuffle** (unused pool candidates) / **Switch mode/goal**.
3. **Reason** — fan out one Agent per expert, all in a single message (parallel). Each agent: read its profile at the absolute path; reason from documented positions applied to the user's context; respect "Would NEVER Say" guardrails; for living figures prefer newer model knowledge past the `Verified:` date; refute on → attack the user's position. Return the expert's actual argument (a few sentences), name attached; PANEL adds one `dissent` line vs the likely consensus.
4. **Present** — each expert's reasoning as attributed prose; PANEL names each disagreement and both sides. Close with one AskUserQuestion — never a forced recommendation: **Go deeper** (narrow lens, re-run 3) / **Different perspective** (back to 2) / **Challenge it** (refute on, re-run 3) / **Done** (no recap).

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

## Boundary

Consult surfaces knowledge — it does not execute or decide. The caller owns the decision; expert perspectives are understanding to learn from, not prescriptions to follow.
