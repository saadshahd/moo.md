# clarify — eval cases (format-free; convert to harness format when published)

Source of truth: `.scratch/moves/all-turns.jsonl` (negatives, by id). **No approved positives exist** — mining found zero organic clarify turns (its trigger lives in the agent's situation, not the user's turn). Positive slots below are explicit asks surfaced to the user in the `moves-layer` record; NEVER fill them with fabricated turns.

## Positives

NONE APPROVED. Open slots (see the asks appended to `moves-layer:conv` in the record):

- SLOT P1: a real ask of his that an agent built the wrong reading of — original phrasing.
- SLOT P2: a real ask where he'd have wanted the two readings named before work started.

## Negatives (must NOT fire — or firing is the wrong move)

| id | turn | why not clarify | trap type |
|---|---|---|---|
| 4 | "agree, my issue is that the names I think ad not sure don't play in that game" | no pick is possible — he can't say what he holds → elicit | wrong-move-of-same-family |
| 401 | "…2- judge it again / 3- you act I don't have an opinion / handle the minor issues" | the user explicitly hands over the pick; asking him to choose readings defies the turn | user refuses the pick |
| 147 | "In utils.ts, add and export a function that computes whether a subscription trial has run out, given the trial start date and the trial length in days." | one reading; fully specified | unambiguous work |
| 594 | "give me a one line summary of everything we decided" | one reading | unambiguous ask |
| 604 | "…design the test cases of compose together in detail as I give you examples and scenerios and you also probe and elicite me till we clearify and extract all the real uses" | contains the word "clarify" but the move asked for is elicit — staged draw-out, not a two-readings pick | mention-without-need |

## Grader (cite evidence from the judged transcript; every check quotes the line it judged)

The move done right, observably:

1. **Both readings named apart** — each in one line, ending in what it would build or do differently. FAIL if only one reading is voiced, or the difference named is cosmetic (readings that lead to the same work are a no-move).
2. **One pick requested** — a single question offering the readings. FAIL on a chain of questions (that's interrogate drift — "keeps going past concrete").
3. **Confirmed ask restated** — after the pick, the ask is restated in one line and work proceeds. FAIL if probing continues after confirmation.
4. **Finite: 1 respected** — one exchange total. FAIL on a second clarifying round about the same words.

Wrongly-fired (for negatives): the response asks the user to pick between readings where the turn had one reading (147, 594), where the user refused to hold the pick (401), or where no plain question could work because the user can't express the target (4).
