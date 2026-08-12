# widen — eval cases (format-free; convert to harness format when published)

Source of truth: `.scratch/moves/all-turns.jsonl` (negatives, by id). **No approved positives exist** — the one mined widen turn (id 402) is lab-tagged and outside `seeds.json`, the only approved positive source. Positive slots below are explicit asks surfaced to the user in the `moves-layer` record; NEVER fill them with fabricated turns.

## Positives

NONE APPROVED. Open slots (see the asks appended to `moves-layer:conv` in the record):

- SLOT P1: a real moment he saw one bad specimen and wanted the rule that prevents the whole class — his organic phrasing (id 402 shows the shape but is lab-contaminated).
- SLOT P2: a rule of his that later failed on a case it should have decided — the turn where widening should have fired.

## Negatives (must NOT fire — or firing is the wrong move)

| id | turn | why not widen | trap type |
|---|---|---|---|
| 38 | "one line prompt that I could reuse across all sessions to pickup and proceed the wayfinder map" | "reuse across all sessions" sounds like broadening, but the workflow is a closed set wanting the shortest statement → compress | reuse-vocabulary bait |
| 57 | "I will drive the map, give me a prompt to start a next session… give me the minimal prompt" | closed workflow, minimal statement → compress | wrong-refit-of-same-family |
| 594 | "give me a one line summary of everything we decided" | closed set; nothing unseen coming → compress | wrong-refit-of-same-family |
| 208 | "Apply statement + _Avoid_ / and also need t find a better detect" | the rule needs to be *checkable* by anyone, not broader → anchor | wrong-refit-of-same-family |
| 257 | "what is the crew hunch claim? what is the proper fixture that I could run crew on vs naive vs sequential where we identify crew real value and wins" | restating a claim as a runnable fixture → anchor | checkability, not breadth |

## Grader (cite evidence from the judged transcript; every check quotes the line it judged)

The move done right, observably (the Prompt in the draft body IS the spec — `moves/refit.md` Widen):

1. **No summary** — the cases are not summarized; a rule is induced. FAIL if the output restates the cases.
2. **Sound on every case** — the rule gets each input case exactly right AND forbids the wrong answer in each; the grader checks case-by-case. FAIL on one miss.
3. **Ten unseen situations, each decided** — ≥10 situations not in the cases, each with the definite answer the rule forces. FAIL on hedged answers ("it depends").
4. **The narrow loop ran** — a counter-situation was sought; if found, the rule was narrowed by the smallest amount and re-probed. FAIL if no refutation attempt appears.
5. **Decides-more beats shorter** — where the transcript shows a choice, the rule that decides more situations won even at longer statement length.

Wrongly-fired (for negatives): the response inducts a general rule where the turn wanted the shortest statement of a closed set (38, 57, 594) or a mechanical check for an existing rule (208, 257).
