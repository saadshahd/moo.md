# interrogate — eval cases (format-free; convert to harness format when published)

Source of truth: `.scratch/moves/all-turns.jsonl` (negatives, by id). **No approved positives exist** — mining found zero organic interrogate turns (nobody types "interrogate me"; the trigger lives in the agent's situation: a commitment just landed, undefended). Positive slots below are explicit asks surfaced to the user in the `moves-layer` record; NEVER fill them with fabricated turns.

## Positives

NONE APPROVED. Open slots (see the asks appended to `moves-layer:conv` in the record):

- SLOT P1: a proposal he had committed to where he'd want to be made to defend each decision — his phrasing at the moment of commitment.
- SLOT P2: a locked card/plan a later regret traced back to — the turn where interrogation should have fired.

## Negatives (must NOT fire — or firing is the wrong move)

| id | turn | why not interrogate | trap type |
|---|---|---|---|
| 146 | "a skill that has all rules might be less auto invoked, what about a set of skills… what do you think?" | a proposal, but NOT committed — he's asking for a verdict → judge | proposal-shaped, uncommitted |
| 415 | "…can I do passive income with that knowledge… stage a deep eleication…" | an aspiration, nothing to defend → elicit | commitment absent |
| 400 | "adversiely review the staged changes and release patches of the changed plugins if all green" | could finish with the user absent → not a move; review/audit | the out-of-set boundary |
| 411 | "commit push patch release, but first run a an audit on the rule / it shouldn't coradiact and should have value to coding agents" | audit criteria fully stated; user not needed per question | the out-of-set boundary |
| 571 | "I made my changes to the skill draft - review it - what do u think?" | wants review + verdict on artifact quality, not a defence of his decisions → judge | committed artifact, verdict ask |

## Grader (cite evidence from the judged transcript; every check quotes the line it judged)

The move done right, observably:

1. **Targets undefended decisions** — each question names a decision inside the committed proposal and asks what breaks, what was traded, or why-this-over-nearest. FAIL if questions tour the proposal generally.
2. **One question at a time** — the interviewing protocol's borrowed stop. FAIL on question batteries.
3. **Only what the user alone can answer** — anything answerable from the repo or the record is answered by the agent, not asked. FAIL on one outsourceable question.
4. **Answers are consumed** — each answer is kept as a defence, recorded as an amendment, or followed to the next undefended decision; quote the consumption. FAIL if answers vanish.
5. **Retires on defended** — the move ends when surfaced decisions carry defences in the user's own words; the close names them. FAIL if it keeps going past defended (or never closes).

Wrongly-fired (for negatives): the response starts making the user defend decisions where no commitment exists (146, 415), where a verdict was asked for (571), or where the whole job could finish with the user absent (400, 411).
