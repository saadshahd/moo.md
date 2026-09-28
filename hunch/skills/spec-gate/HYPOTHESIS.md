With tend on, once intent, shape or one of the four moves runs, Claude's first edit waits until the card quotes the user's goal and done-check in the user's own words. Asking is never held; the user's "go" opens it. A held edit sends Claude back to ask, so the moves loop until the spec holds the user's words.

Graduate when, over 10 real sessions where it arms, the user corrects what they wanted after the first edit in at most 1, and says "go" to get past it in at most 3. Kill if the user calls the hold ritual, or Claude fills `said` with words that are the user's but not their goal or done-check.

## Field notes

### 2026-09-28 — founding, from 91 intent runs across all projects

- intent's "route again" never fired: 59 runs routed no move, 32 routed one. A prompt did not make the loop; a hold on the edit does.
- In ~10 of 50 real intent sessions the user corrected what they wanted after the work order. Must-not constraints matched ~6 of them; the user chose goal and done-check as the slots.
- Only the first Edit, Write, MultiEdit or NotebookEdit is held. Writes through Bash pass: a live run showed Claude offering Bash as a way round, in the open.
- A card written earlier in the same turn counts: a live run held the Write, Claude wrote the card, and the next Write went through.
- Code checks each quote against the user's messages and AskUserQuestion answers. It checks the words are theirs, not that they state a goal. The optional Jev check per slot is not built: unmeasured, and the TypeSafe credit ran out.
