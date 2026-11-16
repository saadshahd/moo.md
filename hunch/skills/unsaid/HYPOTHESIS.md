With unsaid on, intent writes its work order as an `order` block, and each of its `ask` and `bar` lines is checked against the user's own words: what they typed and what they picked in Claude's questions. A line they never said becomes a question in tend's questions chip ("You never said …. Keep it in the work order?"), and every such question reaches Claude with the user's next prompt, answered or not. A restated order is checked again, up to 3 times a session. Nothing waits on the user, and nothing wakes Claude.

Graduate when, over 10 real intent sessions with unsaid on, the user corrects what they wanted after the work order in at most 1 (the measured rate before it was 10 in 50), and a re-measure keeps the label at 0.8 or more on each class. Kill if the user turns it off, answers none of its questions across 10 sessions, or later corrects a line the label called said in 2 of 10 sessions.

## The label's bar

The said/assumed label is a model check (Haiku, one `$.model.classify` call per line), so it has a rate, not a guarantee. Its bar is 0.8, as hum's `minJudgeRate`, on each class: assumed lines it catches, and said lines it leaves alone. Raw accuracy alone is too easy here: 72% of lines are assumed, so a label that calls every line assumed scores 0.72. While both classes clear 0.8, an unanswered question reaches Claude; below that, only the lines the user answers would.

Re-measure with `bun hunch/skills/unsaid/eval.ts <cases.jsonl> --out <folder> --runs 3`. It runs the mod's own code in a headless session and keeps each run's raw labels, so `--runs 0` rescores them.

## Field notes

### 2026-11-16 — founding, from 80 real work orders

| runs | lines | rate | each run | assumed caught | said kept |
|---|---|---|---|---|---|
| 3 | 1,098 | 0.85 | 0.84, 0.85, 0.85 | 660/792 (0.83) | 269/306 (0.88) |

- Cases: the first work order after intent loaded in each of 80 real sessions, 2026-09 to 2026-11: moo.md 30, roundup 26, songs 12, 12 from other repos. Their 366 ask and bar lines were checked; 2 orders that a resumed session repeated were dropped.
- Labels: two model labellers each labelled every line from the user's words alone and quoted the words behind each said line; code found every quote in the words. They agreed on 97% of lines, and the builder settled the other 12. The user has checked none.
- The cases hold the user's own words from private repos, so they stay out of the repo, at `~/.local/share/moo/evals/unsaid/cases.jsonl` on the machine that measured them.
- 74 of 80 orders hold at least one unsaid line, 3.3 on average. One order would raise 18 questions.
- Not measured yet: whether the questions prevent the corrections, and how the user's own labels agree with these.
