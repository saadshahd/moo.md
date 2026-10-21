With `dream` on demand, a project whose facts moved gets its memory notes checked against the repo and fixed, at a cost the user chooses to pay, with every change one revertable commit.

Graduate when 3 real runs on different projects each fix at least one note the user agrees was false, and none needs a revert. Kill if the user reverts a dream, or stops running it because the fixes are not worth the cost.

## Field notes

### 2026-10-21 — founding

- Claude Code ships its own dream, but a server flag (`tengu_onyx_plover`) keeps it off on this machine; it last ran 2026-04-13.
- On demand over nightly: most stale notes mislead nobody (31–71% of notes are never read in any session). The valuable fixes sit in projects whose facts moved through events in the user's life, not file changes, which a nightly rule keyed on changed files misses. The user runs it when they sense that.
- Labeled set: 326 real notes in three folders, labeled by agents, 20 rows spot-checked by the user. Labels and grader stay outside the repo (`~/.claude/dream-eval/`): they quote private notes.
- One call over a whole folder checks a few notes and stops (Sonnet, moo's 86 notes: read ~5, fixed 0 of 3 labeled). Batches of 15, one call each, fixed 2 of 3 and five more true fixes the labels missed. No note deleted, no write outside the memory dir, $2.12.
- Not yet measured: since the graded run, the index pass uses our own prompt (`index.md`), not Anthropic's, and the passes have no shell: an allowed `git log` could write files (`--output`, probed), so repo history comes precomputed and a pass deletes a note by emptying it. ISA and songs-with-suno were not run (user declined the ~$6). The trust bar (9 runs) is unmet; trust rests on one run and `git revert`.
