# elicit — eval cases (format-free; convert to harness format when published)

Source of truth: `.scratch/moves/seeds.json` (positives — the only approved source), `.scratch/moves/all-turns.jsonl` (negatives, by id). No fabricated cases.

## Positives (all organic seeds)

| id | turn (verbatim source in seeds.json) | why it fires |
|---|---|---|
| 4 | "agree, my issue is that the names I think ad not sure don't play in that game" | holds a naming unease he can't articulate — "I think and not sure" |
| 167 | "Let's grill about the unique concepts in this codebase. I want to extract the transferable knowledge and validate and understand it…" | holds techniques he can't yet name as transferable knowledge |
| 415 | "…can I do passive income with that knowledge… stage a deep eleication to figure out possbilties" | explicitly asks for elicitation of possibilities he can't enumerate |
| 421 | "can I use my ai access and free time to make me have a sustinable life ?" | vague life aspiration; a plain answer can't work |
| 438 | "I want to lean something interesting elicite me on what then how" | asks in the move's own word; "interesting" is held, unexpressed |
| 439 | "why did you choose these? dig deeper these bore me now…" | rejects offers — the reaction IS the material; taste needs deeper draw-out |
| 440 | "not these too start from a general point not relevant to any memory, I want inspirations…" | second rejection steering the draw-out; still can't name the target |
| 442 | "I want you to open new lanes for me. I'm bored and I feel there is no thing new to learn and evolove" | boredom held, target inexpressible |

Note 439/440 are mid-move turns: they grade the *continuation* of an elicit (react-adjust-offer), not its opening.

## Negatives (must NOT fire — or firing is the wrong move)

| id | turn | why not elicit | trap type |
|---|---|---|---|
| 441 | "I don't get or understand the engine question" | the user is missing something settled — flow is agent→user → explain | wrong-move-of-same-family (inverse direction) |
| 519 | "you aren't getting me I meant we use spawn agent only… but use batch tool call in claude code is there such a thing?" | user CAN express — he just did, as a correction; the tail is a settled-fact question | looks like failed-communication, isn't inexpressible |
| 53 | "give me one line prompt to start next session" | plain compliance ask (compress) | plain work |
| 147 | "In utils.ts, add and export a function…" | fully specified work request | plain work |
| 594 | "give me a one line summary of everything we decided" | closed set, wants the short statement — nothing held-unsaid | mention-adjacent (sounds reflective) |

## Grader (cite evidence from the judged transcript; every check quotes the line it judged)

The move done right, observably:

1. **Reactable offer, not a question list** — the response puts forward one concrete thing to react to (a candidate, a contrast, a small set to pick apart). FAIL if it's a battery of questions or abstract unexperienced choices.
2. **One offer per turn** — the interviewing protocol's borrowed stop: a single probe, then wait. FAIL on multi-front probing in one turn.
3. **Builds on the last reaction** — mid-move (439, 440), the new offer visibly incorporates what the rejection taught; quote the incorporation. FAIL if the next offer ignores the reaction.
4. **The record grows in the user's words** — confirmed pieces are kept/echoed in language the user used or accepted. FAIL if the agent's paraphrase replaces the user's framing without confirmation.
5. **Knows when to stop staging** — if a reaction shows a direct question would land, it gets asked. FAIL if the response keeps staging past that point.

Wrongly-fired (for negatives): the response stages a draw-out — offers, probes, "let's explore what you mean" — where a plain answer (441, 519), plain compliance (53, 147), or a summary (594) was the whole job.
