---
name: intent
description: Turn rough ideas into clear work orders before planning or building. Use when request is vague like "add a button", "make it better", "fix the thing". Triggers on ambiguous or underspecified requests.
---

Clarify WHAT before building anything. Clarity over completeness — invented details are worse than gaps. Structured input (proposal, design, spec) gets validated, not re-clarified. Output: a handoff card (spec below).

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

## Work loop

1. **Understand** — state what you heard in 1-2 sentences.
2. **Close gaps** — unknowns are anything you would have to invent to write the card now. Explore the accessible surface first; elicit only the judgment calls that remain (mechanics below).
3. **Probe the negative** — at least once, ask what this should NOT do.
4. **Gate** — when nothing remains that you would otherwise invent, run the gate audit.

<!-- doc-gen FILE src=../prompts.md -->
Closing unknowns — three modes, one boundary:

- **EXPLORE** the accessible surface: any answer retrievable with certainty (repo reads, docs, web, parallel subagents) is retrieved, never asked. Return with decisions, not raw findings.
- **ELICIT** the user: only judgment calls no accessible surface can settle (their goal, taste, a tie between viable paths). Each AskUserQuestion: exactly 3 concrete candidate answers + 1 uniform "Gather facts" escape hatch (first-class option, never hidden behind Other). Everything needed to answer lives inside the question UI — question text, descriptions, previews — never in prose before the tool call (the dialog hides it).
- **INTERVIEWING** is the anti-pattern: serial quizzing, generic checklists, asking what exploration could answer.

Re-entry after a detour: if the detour made the answer obvious, state the decision and proceed; otherwise re-ask the same question with the new evidence inside the prompt.
<!-- end-doc-gen -->

## The gate

"Is the intent clear enough?" — agent audits, user locks.

<!-- doc-gen FILE src=../gate.md -->
- Before presenting, run a deletion pass over the draft card: cut every fact that does not earn its place, every empty section, every temporal or volatile reference.
- Then a completeness pass: would the next stage have to re-ask the human anything this stage settled — a decision (the tie the human's goal broke), an option declined when offered, or a hard-won external fact? If yes, carry it with the reason code can't re-derive it. "The next stage doesn't re-ask" is the arbiter. Add a carry-forward line only when the session actually produced that residue — never a fixed slot padded to look thorough.
- Present verdict-FIRST via AskUserQuestion: the gate question answered PASSES or FAILS, then the deletion pass's kills (what was cut and why) and the completeness pass's carries (what was kept and why code can't re-derive it).
- On FAIL: name exactly what is missing and ask for it. Never pad the card to look complete.
- The user locks. The lock is theirs, not yours.
<!-- end-doc-gen -->

## Boundaries

User owns intent. "I know what I want" → proceed without clarification. Diverging interpretations → present options, never pick for them.
