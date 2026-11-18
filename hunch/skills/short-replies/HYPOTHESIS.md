With tend on, a reply with more prose than two 80-column lines is redrawn short once its turn ends. Sonnet lists what the reply must cover (each decision it asks, result, option with why it won or lost, and next action), then Haiku rewrites the reply from that list, one fact per sentence or row, and cuts it again, up to 3 passes. Each rewrite is told to keep, in the reply's own words, every step the user takes and when, an option's details, every figure, who acts, the reason behind each verdict, what the agent agreed to do from now on, and each offer or question waiting on the user. A pass shows only if it keeps every number, `code` span and link of the reply, and every expert it names; commit hashes, ids and dates never count, so a short form may always cut them, while the long reply keeps them for Claude and `/long` shows them. The last pass that kept all shows, and when the first did not, the reply stays long. `/long` shows replies at full length again; a prompt that says "explain" or "walk me through" keeps its reply long.

Graduate when it stays on for 10 real sessions, the user runs `/long` in at most two of them, and never calls a short reply a wall of text. Kill if the user turns it off, runs `/long` to recover a fact the short reply cut, or a later turn leans on text only the long reply held.

## The label's bar

A Haiku label also reads each listed item against the short form: covered or missing. It has a rate, not a guarantee. Its bar is 0.8, as hum's `minJudgeRate`, on each class: cuts the readers found that it catches, and redraws they passed that it leaves alone. Below the bar it decides nothing and shows nothing: what it calls missing in the shown pass is kept in tend's store beside the short form, for a later measure. A reply no pass could shorten whole just stays long, with no toast; only a model call that fails shows, once. On #93 the user ruled that a check audits silently rather than add output.

Re-measure with `bun hunch/skills/short-replies/eval.ts <cases.jsonl> --out <folder> --runs 3 --redraws 1`. It runs tend's own code in a headless session and keeps each run's raw output, so `--runs 0` rescores them.

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

### 2026-11-17 — a must-keep list and a Sonnet cover list, measured on 100 fresh replies

Main's redraw (0.21.0) cut a median 38% of the prose but dropped something the user would act on in about 1 reply in 4. This version makes two changes and nothing else: each rewrite is told to keep, in the reply's own words, the facts the user acts on, and Sonnet writes the cover list in place of Haiku. It still runs 3 passes with the code check; the label still only records.

| set | version | dropped a point | 95% range | prose cut, median |
|---|---|---|---|---|
| tuning: 98 replies, 2026-10-01 to 2026-11-16 | keep-list | 4/98 | 0.02–0.10 | 26.3% |
| fresh: 100 later replies no earlier round used | keep-list | 8/100 | 0.04–0.15 | 24.5% |
| fresh | main (0.21.0) | 20/100 | 0.13–0.29 | 32.8% |
| tuning: the 56 replies it showed | 0.20.0 one rewrite | 1/56 | 0.00–0.09 | 4% |

- Ranges are Wilson 95% intervals on the share of replies that dropped a point. Prose cut is the median over every reply in the set, and a reply left long counts as 0%.
- Two Opus readers labelled every short form blind, in one random order with no mark of version or pass. The measuring agent settled their splits.
- The keep-list version was picked from 12 or more on the tuning set, so its 4/98 looks better than it is. The fresh set's 8/100 is the number to trust.
- The bar was at most 5 drops with a prose cut of at least 25%. The fresh set missed both (8; 24.5%). The user chose this version anyway as the best trade: Sonnet writing every pass dropped 0 of 98 but cut 16%, and the 0.20.0 single rewrite dropped 1 of 56 but cut 4%.
- It took about 17 seconds in the median, as main does.
- What it dropped on the fresh set: something still in progress shown as live, a dissenting recommendation, an assembly step, credit wording for a public release, message text the user would paste (reworded), a reversal of the user's own earlier cut, a design rule handed to another agent, and why a deletion is safe.
- Not measured: a live session, and whether the 8 drops matter to the user.
- The cases hold the user's words from private repos, so they stay on the Mac that measured them, under `~/.local/share/moo/evals/redraw/heldout/`.

### 2026-11-18 — a word-list check for AI tells, measured and not built, from cursor's pstack `unslop`

The proposal: a script that fences the redraw by flagging banned AI words (additionally, crucial, delve, enhance, foster, landscape, pivotal, showcase, testament, underscore, vibrant), curly quotes and decorative emoji that a pass adds.

| where | what it found |
|---|---|
| 757 stored redraw passes | 0 added a banned word, a curly quote or an emoji |
| 3,636 stored long replies | 0 banned words, 0 curly quotes; 15 with a pictograph such as ⏸ or 👍 |
| 309 repo `.md` files | 19 banned words, mostly "enhancement" and "landscape"; 0 curly quotes |

- Not built: the check would have fired 0 times in 757 passes. Build it when a count shows redraws adding these.
