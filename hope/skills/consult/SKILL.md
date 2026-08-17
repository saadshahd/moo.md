---
name: consult
description: Bring how named experts would think about the question. Use when the user wants expert thinking on a tradeoff, choice, or stuck problem — not a verdict.
---

Turn a question the user wants expert thinking on into named experts' reasoning, in their voices, with the disagreements left standing.

## Needs

A question of judgment or taste — a tradeoff, a design choice, a repeated failure — where the user wants to learn how others think, not have the answer picked.

## Gives

Two or three named experts' reasoning on the user's actual situation — each grounded in documented work, each in its own voice, disagreements named and left standing. The user decides; consult never does.

## Moves

One job: put each expert's thinking in the user's head. That is **explain**, called by name once per expert — the settled thing is the expert's documented position, applied to the question at hand.

- Pick the experts: read `profiles/` and match the question's domain; prefer two whose positions pull against each other. No profile fits → use experts the model knows well, named, and say the profile is missing.
- Ground each take in the profile or documented work: reasoning in the expert's voice — "Fowler argues…", "Hickey would push back…" — never stripped to a verdict label.
- Where they disagree, name the disagreement and both sides. If everyone agrees easily, the experts were picked wrong — swap one.

## Turns

`open`
- **Advances:** the user pulls — deeper on one expert, a different perspective, "who would disagree with this".
- **Retires:** the user says done or starts deciding. No recap, no closing recommendation.

## Wrong move if

The user wants a ruling on their own thing → **judge**.
The user wants their committed choice attacked → **interrogate**.
The question has one retrievable answer → retrieve it; no expert needed.
