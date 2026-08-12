# explain — eval cases (format-free; convert to harness format when published)

Source of truth: `.scratch/moves/seeds.json` (positives — the only approved source), `.scratch/moves/all-turns.jsonl` (negatives, by id). No fabricated cases.

## Positives (7 — all organic seeds)

| id | turn (verbatim source in seeds.json) | why it fires |
|---|---|---|
| 172 | "tell me more about your \"Flink CEP\" surfacing / I don't get soft coding … I also still don't understand the category theory in this project and it's value" | settled concepts in the project he doesn't hold; prior explanation failed to land |
| 422 | "what are these numbers and what are these conversations?" | settled artifact on screen he can't read |
| 441 | "I don't get or understand the engine question" | the agent's own question didn't land — restate plainly |
| 445 | "learn soloterm inside out / is it extendable?" | settled external system; wants it in his head |
| 446 | "what are routines, how to try it out simple and self document what we can use from it before brainstorming what to do exactly" | settled feature; understanding explicitly gated before ideation |
| 452 | "I don't use coast at all anymore / tell me more about the 3rd idea" | pull for depth on one named item — depth-where-pulled |
| 463 | "also why the external field seem fully unstyled ?" | settled behavior (rendering) he doesn't hold the cause of |

## Negatives (must NOT fire — or firing is the wrong move)

| id | turn | why not explain | trap type |
|---|---|---|---|
| 4 | "agree, my issue is that the names I think ad not sure don't play in that game" | he holds an unease he can't express; the agent is the one who must learn → elicit | wrong-move-of-same-family |
| 155 | "read the sound corpus fully, do you see gaps? I would like to learn about the gaps…" | says "learn", but the gaps aren't settled — they must be drawn out and built together → elicit | mention-without-need ("learn") |
| 449 | "Open the demo in agent-browser and give me your own read on Almond before we decide its fate" | wants the agent's verdict, not understanding transfer → judge | verdict-shaped question |
| 147 | "In utils.ts, add and export a function that computes whether a subscription trial has run out…" | plain work request; nothing unheld | plain work |
| 37 | "commit all work and give me online next session prompt" | plain work + a compress ask | plain work |

## Grader (cite evidence from the judged transcript; every check quotes the line it judged)

The move done right, observably:

1. **One plain line first** — the first sentence states the core; a reader who doesn't hold the concept can parse it. FAIL if the response opens with preamble, structure, or a wall.
2. **No unexplained jargon in that line** — any term of art in the first sentence is either the user's own word or immediately glossed. FAIL on one unglossed term.
3. **Depth only where pulled** — beyond the first line, content follows the user's pull (their question/probe); the response ends with probeable directions or stops. FAIL if the full picture arrives unpulled.
4. **Re-landing, not re-piling** — if the transcript shows a prior failed landing (172, 441), the response takes a *different* plain line, not more words on the old one.

Wrongly-fired (for negatives): the response stages a one-line-then-pull explanation of something the turn didn't need held — instead of doing the work (147, 37), giving a verdict (449), or drawing the user out (4, 155).
