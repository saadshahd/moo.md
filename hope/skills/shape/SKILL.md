---
name: shape
description: Resolves technical HOW decisions — architecture choices, technology selection, and design patterns. Use shape when the intent is clear but the technical path is not. Triggers on "shape this", "architecture for X", "how should I build", "which pattern", "technical approach".
---

Decide HOW before building.

## Contract

- **INPUT** — a locked intent card or an equivalent spec: the goal is clear, the technical path is not.
- **GATE** — "Is the shape complete and implementable?" — agent audits, user locks.
- **OUTPUT** — a handoff card (spec below).

<!-- doc-gen FILE src=../card.md -->
## The card

The pipeline's handoff artifact. One admission rule: carry only what the next stage can't cheaply re-derive from the code in front of it.

- **Checksum first** — open with one sentence: what this is, why it exists. Everything after is facts.
- **Recoverability test** — admit a fact only if the next stage couldn't cheaply recover it by reading the code: re-read all the code later — could it land on the same choice for the same reason? Yes → re-derivable, never carry. Cheap local facts always answer yes. Two kinds answer no. A **decision** — the code compiles either way (indifferent between ≥2 paths) and the human's goal, not any retrievable fact, broke the tie (e.g. cursor pagination over offset because the product needs stable ordering under writes); carry the choice, its reason, and the viable paths declined. A **hard-won external fact** — a dependency or third-party behavior whose ground truth lives outside this codebase and cost steering to pin down.
- **Vocabulary, not template** — sections (non-goals, acceptance, constraints, ...) appear only when the session produced them. No empty scaffolding, ever.
- **Stranger test** — every fact must be understandable with zero session context.
- **No temporal information** — no session narrative, no relative time ("currently", "for now"). Phrase decisions timelessly: "X over Y: reason". Absolute dates only when the fact IS a deadline.
- **No volatile references** — concepts only. No file paths, function names, or line numbers. The next stage retrieves its own cheap local detail.
- **No provenance markup** — provenance was visible live in the session, not encoded in the artifact.
- **Carry-forward last** — the costly residue the human won't re-read closes the card: decisions and their reasons, paths ruled out (what was steered away from — including an option the human declined when it was offered), and hard-won external facts. Captured when the stage locks so the next stage skips the work that produced them. The human reads it only if they want.
- **Size by deletion, not cap** — a deletion pass in the gate audit governs length: every fact earns its place. Never a numeric limit.
- **Storage-agnostic** — emit in conversation. Persisting it is the user's call; because a complete card passes the stranger test, a persisted card is a resume token — paste it into a new session and the stage resumes without re-asking. No store, no convention beyond paste.
<!-- end-doc-gen -->

## Presentation

- **Minto pyramid via AskUserQuestion** — Label = recommendation (conclusion first). Description = one-line tradeoff (always visible). Detail panel = structured plain text in AskUserQuestion's monospace preview box — short lines (~50 chars), ALL CAPS section headers, dashes for bullets. No markdown formatting (renders as literal text).
- **Batch independent choices** — non-conflicting dimensions go into a single AskUserQuestion (up to 4 questions per call). Separate only where one choice constrains another.
- **Techniques are internal** — apply reasoning techniques in your thinking; present the insights they produce in plain language. Never name techniques in user-facing output.
- **Brief scannable output** — bullets over paragraphs, findings in 1-2 lines each, no text walls between prompts.

## The work loop

1. **Prime taste** — load the user's known taste from CLAUDE.md / TASTE.md / a prior card before projecting any option. Elicit when it is unclear or absent — bias to ask rather than guess.
2. **Extract** — pull the HOW dimensions from the input: architecture, data model, API design, testing, deployment — whatever the spec actually opens. When the work iterates, *which loop* is one such dimension (see Loop selection).
3. **Resolve per dimension** — auto-gather when the answer is retrievable with certainty. At a non-obvious call, project 3 options through the primed taste, scoped to the task, then sketch and co-design them with the user via decision prompts (mechanics below).
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
- Auto-gather when the answer is retrievable with certainty: cheap local reads, docs, web research, parallel subagents. Return with decisions, not raw findings. Never ask the user something research already made obvious — that is a named stop condition.
- Only non-obvious judgment calls reach the user. Every such AskUserQuestion: exactly 3 candidate answers + 1 uniform escape hatch — "Gather facts" (research/explore). The hatch is a first-class option, never hidden behind Other.
- Re-entry after a detour: if the detour made the answer obvious, state the decision and proceed; otherwise re-ask the same question with the new evidence inside the prompt.
- Presentation rule: EVERYTHING the user needs to answer lives inside the question UI — question text, descriptions, previews. Never in prose before the tool call (the dialog hides it).
<!-- end-doc-gen -->

## The gate

"Is the shape complete and implementable?" — agent audits, user locks.

<!-- doc-gen FILE src=../gate.md -->
- Before presenting, run a deletion pass over the draft card: cut every fact that does not earn its place, every empty section, every temporal or volatile reference.
- Then a completeness pass: would the next stage have to re-ask the human anything this stage already settled — a decision (the tie the human's goal broke), an option declined when offered, or a hard-won external fact? If yes, it is missing — carry it with the reason code can't re-derive it. Deletion keeps the card short; completeness keeps it sufficient. The two run together; "the next stage doesn't re-ask" is the arbiter. Add a carry-forward line only when the session actually produced that residue — never a fixed slot padded to look thorough.
- Present verdict-FIRST via AskUserQuestion: the gate question answered PASSES or FAILS, then the deletion pass's kills (what was cut and why) AND the completeness pass's carries (what was kept and why code can't re-derive it) — proof both passes ran.
- On FAIL: name exactly what is missing and ask for it. Never pad the card to look complete.
- The user locks. The lock is theirs, not yours.
<!-- end-doc-gen -->

## Boundaries

Shape surfaces choices; the user owns architecture. When uncertain about risk, bias toward more human involvement.
