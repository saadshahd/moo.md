With tend on, a reply with more prose than two 80-column lines is redrawn short once its turn ends: a haiku rewrite that keeps every decision, result and next action, one fact per sentence or row. `/long` shows replies at full length again; a prompt that says "explain" or "walk me through" keeps its reply long.

Graduate when it stays on for 10 real sessions, the user runs `/long` in at most two of them, and never calls a short reply a wall of text. Kill if the user turns it off, runs `/long` to recover a fact the short reply cut, or a later turn leans on text only the long reply held.

## Field notes

### 2026-09-28 — founding, from a blind ranking of 12 real replies (#51)

- Rewording Plain never moved walls of text. A second pass over the finished reply did: over 5 rounds the user ranked it above the old reply in 11 of 12 cases, including all 4 held back until the last round.
- A wall, in the user's word, is packed facts: several facts in one line, even in a 24-word reply. Length is not the test.
- Cutting facts to fix packing lost cases: a rewrite with one fact per sentence won 9 of 12, where the facts it dropped were ones the user wanted. The prompt keeps facts and splits them.
- Commit hashes, ids and dates are noise unless the user must act on one.
- No event fires before a reply shows, so the long reply streams first and the short one replaces it a few seconds after the turn ends. The model still sees its long reply.
- The done bar (at least 10 of 12 preferred AND no short reply called a wall) was not met in the replays; this runs live to find out.
