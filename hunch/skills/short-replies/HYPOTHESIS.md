With tend on, a reply with more prose than two 80-column lines is redrawn short once its turn ends. Haiku lists what the reply must keep (each decision it asks, result, option with why it won or lost, and next action), then rewrites the reply from that list, one fact per sentence or row, and cuts it again, up to 3 passes. A pass shows only if it keeps every number, `code` span and link of the reply, and every expert it names, and a Sonnet label finds no point it lost that the user would act on; commit hashes, ids and dates never count, so a short form may always cut them, while the long reply keeps them for Claude and `/long` shows them. The last pass that kept all shows, and when the first did not, the reply stays long. `/long` shows replies at full length again; a prompt that says "explain" or "walk me through" keeps its reply long.

Graduate when it stays on for 10 real sessions, the user runs `/long` in at most two of them, and never calls a short reply a wall of text. Kill if the user turns it off, runs `/long` to recover a fact the short reply cut, or a later turn leans on text only the long reply held.

## The label's bar

A Sonnet label reads each pass against the long reply: kept, or lost a point the user would act on, which is a decision asked of them, the reason behind a verdict or pick, an option with why it won or lost, or the next step. File paths, notices of what was saved, counts and how the agent worked may go. It has a rate, not a guarantee. Its bar is 0.8, as hum's `minJudgeRate`, on each class: cuts the readers found that it catches, and redraws they passed that it leaves alone. It met the bar on 2026-11-16, so it gates: a pass it calls lost backs off to the pass before, and a reply whose first pass it calls lost stays long, with no toast. Only a model call that fails shows, once. On #93 the user ruled that a check audits silently rather than add output.

Re-measure with `bun hunch/skills/short-replies/eval.ts <cases.jsonl> --out <folder> --runs 3 --redraws 1`. It runs tend's own code in a headless session and keeps each run's raw output, so `--runs 0` rescores them. A change to the label's model or words is a new measurement.

## Field notes

### 2026-09-28 — founding, from a blind ranking of 12 real replies (#51)

- Rewording Plain never moved walls of text. A second pass over the finished reply did: over 5 rounds the user ranked it above the old reply in 11 of 12 cases, including all 4 held back until the last round.
- A wall, in the user's word, is packed facts: several facts in one line, even in a 24-word reply. Length is not the test.
- Cutting facts to fix packing lost cases: a rewrite with one fact per sentence won 9 of 12, where the facts it dropped were ones the user wanted. The prompt keeps facts and splits them.
- Commit hashes, ids and dates are noise unless the user must act on one.
- No event fires before a reply shows, so the long reply streams first and the short one replaces it a few seconds after the turn ends. The model still sees its long reply.
- The done bar (at least 10 of 12 preferred AND no short reply called a wall) was not met in the replays; this runs live to find out.

### 2026-09-30 — first live count, 11 sessions (#51)

- 105 replies were redrawn in 11 sessions the user drove, 2026-09-28 to 09-30; sessions of Solo parts are left out.
- No later turn leaned on text only the long reply held. No prompt since has called a reply a wall.
- 5 short forms that dropped something the user would act on. Two were one bug: a 7,000-character reply's rewrite filled its 2,048-token cap and stopped mid-table, losing the closing ask. A rewrite that fills its cap is now dropped, and the reply stays long. The other 3 dropped a reason, or the thing an ask pointed at.
- Of 59 replies that asked the user to decide, the ask sat on the last line in 42, the first in 4, the middle in 8, and nowhere in the 2 cut ones.
- `/long` leaves no trace in transcripts, so only the user can say how many sessions used it.

### 2026-09-30 — the user's `/long` runs were checks

- The user ran `/long` in 3 or more sessions, which misses the graduation bar. Most runs were to check that nothing was missing, not to get back a cut fact, so the kill bar isn't met either.
- So far, the `/long` count measures trust, not loss. The redraw stays on, unchanged.

### 2026-11-01 — the token cap dropped whole rewrites

- Haiku's thinking counts in its output tokens. On 8 real replies of 400 to 5,000 characters, a rewrite spent 1,000 to 3,900 tokens.
- 6 of the 8 passed the 2,048 cap, so their replies stayed long, though every rewrite ended whole.
- The cap is now 16,000. At it, 8 of 8 came back whole, the largest at 4,208 tokens.
- A cut rewrite still passes its cap: one cut at a 1,200 cap reported 3,248 tokens.

### 2026-11-16 — every pass is checked, and none that drops a number, `code` span or link shows

| check | runs | cases | cut caught | kept left alone |
|---|---|---|---|---|
| model label | 3 | 282 | 15/15 (1.00) | 120/267 (0.45) |
| code check | 1 | 94 | 3/5 (0.60) | 65/89 (0.73) |

- Cases: the 105 redraws two readers judged on 2026-09-30, as the user saw them. 94 came back whole from the readers' tool output and the transcripts, every one length-checked; one short form was rebuilt from the diff a reader printed. 5 cut something the user needed, 89 did not. The 2 the readers split on are left out, and 9 survive nowhere whole.
- The cases hold the user's own words from private repos, so they stay out of the repo, at `~/.local/share/moo/evals/redraw/cases.jsonl` on the Mac that measured them.
- The label caught all 5 cuts in each run but flagged 55% of the redraws the readers passed (57% in a fourth run). In 4 of the first 6 flags, the old short form had dropped the item, such as a saved file's path or a count of cut ideas, and the readers had not counted it as needed. Below its bar, it only records.
- The code check is exact, so it gates from the start. Each pass is told to keep every number, `code` span and link as written, and every row and column of a table. Commit hashes, ids and dates never count: the user ruled that noise must always be able to leave the short form, while it stays in the long reply for Claude and behind `/long`. On a 17-case trial before the table clause, 5 replies stayed long, every number they lost from a table.
- The code check can't see a lost reason or idea: 2 of the 5 cuts, a draft's verdict and an idea, held no number, `code` or link. Only the label saw them, and it is below its bar.
- One redraw run of the new machine on the 94 long replies:

| shown short | long: lost a token | long: saved nothing | shown at pass 1, 2, 3 | prose cut, median | seconds, median | label flags |
|---|---|---|---|---|---|---|
| 83 | 8 | 3 | 13, 20, 50 | 35% | 17 | 20 of 83 |

- 7 of the 8 that stayed long for a lost token lost one to three numbers; one lost a file path in `code`.
- The old single rewrite cut a median 13% of these replies' prose, in one Haiku call. The new one cuts 35% and takes about 17 seconds, so the short form replaces the long one later.
- Not measured yet: whether the new short forms drop what the user needs. No reader has read them; the label's flags, kept beside each live short form, are where a later count starts.

### 2026-11-16 — the label asks whether a point the user acts on was lost, and gates

- The user, after #95: two of the five cuts lost a reason or an idea with no number, `code` or link in it. 12 labels were scored on the same 94 cases, 3 runs each, raw output kept beside the cases:

| label | cut caught | kept left alone | calls per read | seconds per read, median |
|---|---|---|---|---|
| each cover item, Haiku (0.21.0) | 15/15 | 124/267 (0.46) | 8.5 | 5.8 |
| each cover item, Sonnet | 15/15 | 152/267 (0.57) | 8.8 | 6.5 |
| each cover item, two Haiku reads agree | 15/15 | 134/267 (0.50) | 16.5 | 6.1 |
| cover list of what the user acts on, Haiku | 14/15 | 161/267 (0.60) | 6.1 | 5.0 |
| the same list, Sonnet | 15/15 | 195/267 (0.73) | 6.2 | 5.1 |
| the same list, two Sonnet reads agree | 14/15 | 200/267 (0.75) | 11.5 | 5.5 |
| lost a point the user acts on, Haiku | 14/15 | 210/267 (0.79) | 1 | 1.9 |
| the same, two Haiku reads agree | 13/15 | 227/267 (0.85) | 2 | 2.1 |
| **the same, Sonnet** | **15/15** | **232/267 (0.87)** | **1** | **2.4** |
| the same, two Sonnet reads agree | 15/15 | 234/267 (0.88) | 2 | 2.5 |
| quote each lost point, Haiku | 15/15 | 146/267 (0.55) | 1 | 3.3 |
| quote each lost point, Sonnet | 15/15 | 204/267 (0.76) | 1 | 3.1 |

- Changing the question did most: asking whether the short form lost a point the user acts on, against the long reply, beat checking every cover item. Narrowing the cover list helped less, Sonnet more, and a second read little. Sonnet read once is the cheapest label over the bar, so it gates. Through tend's own code it then scored 15/15 and 230/267 (0.86), each run at least 0.85.
- How far 5 cuts go: catching 5 of 5 says the label's rate on unseen cuts is likely above 0.55, not that it is above 0.8; two of the 5 are one bug. On the 89 passed redraws, 77 of 89 puts the rate between 0.78 and 0.92. Both classes rest on the readers' verdicts, and the earlier flags showed the readers did not count every drop.
- What the gate costs, on one fresh redraw run of the 94 long replies:

| version | shown short | long: lost a point | long: lost a token | long: saved nothing | seconds, median |
|---|---|---|---|---|---|
| 0.21.0 | 83 | — | 8 | 3 | 17 |
| 0.22.0 | 69 | 13 | 7 | 5 | 23 |

- The label alone kept 11 to 13 of about 83 short forms long in 4 runs: this run, and 3 label runs on the passes of 0.21.0's run. No reader has judged these new short forms, so whether the 13 lost what the user needs is not measured yet.
- Each pass adds one Sonnet call of about 800 tokens in and one word out.
