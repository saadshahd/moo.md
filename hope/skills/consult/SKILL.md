---
name: consult
description: Bring how named experts would think about the question. Use when the user wants expert thinking on a tradeoff, choice, or stuck problem — not a verdict.
---

## Extract

From the conversation/context/user:

- The **question** — the tradeoff, design choice, or repeated failure in front of the user.
- Its **domain** — the field the question sits in, which decides who is worth consulting.

## Gate

Proceed only when: the question turns on judgment or taste, and the user wants to learn how others think rather than have the answer picked.

Anything else, say which in one plain line — never consult anyway:

- The question has one retrievable answer → retrieve it and proceed with what it settles; stating a fact needs no expert.
- The user wants a verdict on something that exists → use **judge** skill.
- The user wants a proposal they already committed to attacked → use **interrogate** skill.

## Pick

Read `profiles/` and match the question's domain. Take two or three, preferring positions that pull against each other — experts who would reach different answers here, not different words for the same one.

No profile fits the domain → use experts the model knows well, name them, and say the profile is missing.

## Voice

Each expert's thinking goes into the user's head one at a time. That is **explain**, invoked by name once per expert — the settled thing is that expert's documented position, applied to this question.

- Ground every take in the profile or the expert's documented work, reasoning in their own voice — "Fowler argues…", "Hickey would push back…" — never stripped to a verdict label.
- Where they disagree, name the disagreement and both sides, and leave it standing. Easy agreement means the picking was wrong — swap one and voice it.
- The user drives from there. Each pull is deeper on one expert, a different perspective, or who would push back on this. Answer the pull, then wait for the next.

The loop ends when the user says they are done, or starts deciding.

## Output

The experts' reasoning is the result, and it lives in the user's head. The disagreements stay open: no recap, no closing recommendation, no verdict assembled out of what the experts said. The user decides; consult never does.

When the loop ended because the user started deciding, the consulting is over at that moment — what the experts said stands as said, never as a ruling on the decision they are making.

Then check whether anything still unresolved would change what gets built:

- Nothing would → return to the work the consulting interrupted.
- A claim about something that exists needs a committed verdict → use **judge** skill.
- The user commits to a choice and its decisions stand undefended → use **interrogate** skill.

The consulting is spent once the loop ends — anything further runs under the branch picked here, never as another round of consulting.
