---
name: shape
description: Resolves technical HOW decisions when the intent is clear but the technical path is not — architecture, technology selection, design patterns. Triggers on "shape this", "architecture for X", "how should I build", "which pattern", "technical approach".
---

Decide HOW before building.

## Contract

- **INPUT** — locked intent card or equivalent spec: goal clear, technical path not.
- **GATE** — "Is the shape complete and implementable?" — agent audits, user locks.
- **OUTPUT** — a handoff card (spec below).

<!-- doc-gen FILE src=../card.md -->
## The card

The pipeline's handoff artifact. One admission rule: carry only what the next stage can't cheaply re-derive from the code in front of it. Recoverability test: re-reading all the code later, could it land on the same choice for the same reason? Yes → never carry (cheap local facts always answer yes). Two kinds answer no:

- **Decision** — the code compiles either way; the human's goal, not any retrievable fact, broke the tie between viable paths. Carry the choice, its reason, and the paths declined (including options the human turned down when offered).
- **Hard-won external fact** — dependency or third-party behavior whose ground truth lives outside this codebase and cost steering to pin down.

Form:

- Open with one sentence: what this is, why it exists. Everything after is facts.
- Sections (non-goals, acceptance, constraints, ...) appear only when the session produced them. No empty scaffolding, ever.
- Stranger test: every fact understandable with zero session context.
- Timeless: no session narrative, no relative time ("currently", "for now"). Phrase decisions "X over Y: reason". Absolute dates only when the fact IS a deadline.
- Concepts only: no file paths, function names, or line numbers — the next stage retrieves its own cheap local detail. No provenance markup.
- Carry-forward closes the card: decisions and reasons, paths ruled out, hard-won external facts — captured when the stage locks so the next stage skips the work that produced them.
- Size by deletion pass in the gate audit, never a numeric cap.
- Emit in conversation; persisting is the user's call. A complete card passes the stranger test, so a persisted card is a resume token — paste it into a new session and the stage resumes without re-asking.
<!-- end-doc-gen -->

## The work loop

1. **Prime taste** — load the user's taste from CLAUDE.md / TASTE.md / a prior card before projecting any option. Unclear or absent → ask, don't guess.
2. **Extract** — pull the HOW dimensions the spec actually opens: architecture, data model, API design, testing, deployment. When the work iterates, *which loop* is one dimension (see Loop selection).
3. **Resolve per dimension** — explore when retrievable with certainty. At a non-obvious call, project 3 options through the primed taste, scoped to the task, then co-design them with the user via decision prompts.
4. **Tension check** — if resolved choices genuinely conflict, surface the tension as one more decision prompt.
5. **Gate** — run the gate audit (below).

## Loop selection

When the work iterates — an agent loop, a refinement cycle, an unbabysat run — "which loop" is a HOW dimension. Resolve it on three axes; the card carries the chosen loop and its termination rule.

| Axis | Question | Reliability rule |
| --- | --- | --- |
| Verifier locus | Does "better" come from outside the model — tests, tool result, metric, separate judge — or only the model itself? | No external signal → never loop on a correctness task; it degrades. Take best-of-N first attempts instead. |
| Plan mutability | Plan fixed once, or revised as reality diverges? | A revised plan must carry a budget cap, or it never converges. |
| Termination | Budget cap, signal-gated, fixed-round, or judgment-delegated? | Judgment-delegated (an LLM decides "done") is the silent non-convergence source — always back it with a hard cap. |

Unsupervised loops pass through target; every loop dispatches through delegate.

## Decision prompts

<!-- doc-gen FILE src=../prompts.md -->
Closing unknowns — three modes, one boundary:

- **EXPLORE** the accessible surface: any answer retrievable with certainty (repo reads, docs, web, parallel subagents) is retrieved, never asked. Return with decisions, not raw findings.
- **ELICIT** the user: only judgment calls no accessible surface can settle (their goal, taste, a tie between viable paths). Each AskUserQuestion: exactly 3 concrete candidate answers + 1 uniform "Gather facts" escape hatch (first-class option, never hidden behind Other). Everything needed to answer lives inside the question UI — question text, descriptions, previews — never in prose before the tool call (the dialog hides it).
- **INTERVIEWING** is the anti-pattern: serial quizzing, generic checklists, asking what exploration could answer.

Re-entry after a detour: if the detour made the answer obvious, state the decision and proceed; otherwise re-ask the same question with the new evidence inside the prompt.
<!-- end-doc-gen -->

## Presentation

- Minto pyramid in AskUserQuestion: Label = recommendation, Description = one-line tradeoff, detail panel = plain text (short ~50-char lines, ALL CAPS headers, dash bullets — no markdown; it renders literally).
- Batch independent choices in one call (up to 4 questions); separate only where one choice constrains another.
- Techniques stay internal — present their insights in plain language, never name them. Bullets, 1-2 lines per finding, no text walls.

## The gate

<!-- doc-gen FILE src=../gate.md -->
- Before presenting, run a deletion pass over the draft card: cut every fact that does not earn its place, every empty section, every temporal or volatile reference.
- Then a completeness pass: would the next stage have to re-ask the human anything this stage settled — a decision (the tie the human's goal broke), an option declined when offered, or a hard-won external fact? If yes, carry it with the reason code can't re-derive it. "The next stage doesn't re-ask" is the arbiter. Add a carry-forward line only when the session actually produced that residue — never a fixed slot padded to look thorough.
- Present verdict-FIRST via AskUserQuestion: the gate question answered PASSES or FAILS, then the deletion pass's kills (what was cut and why) and the completeness pass's carries (what was kept and why code can't re-derive it).
- On FAIL: name exactly what is missing and ask for it. Never pad the card to look complete.
- The user locks. The lock is theirs, not yours.
<!-- end-doc-gen -->

## Boundaries

Shape surfaces choices; the user owns architecture. When uncertain about risk, bias toward more human involvement.
