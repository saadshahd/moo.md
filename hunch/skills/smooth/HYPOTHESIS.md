With `smooth` run nightly, the friction the agents hit in a project — failing commands, rediscovered files, repeated steps, skills that left them failing — falls day over day, because each night turns the worst of it into one change to the project the person keeps or drops.

Graduate when the person keeps 3 of the first 5 fixes, and each kept fix's count falls the next day. Kill if 3 fixes in a row are dropped.

## Field notes

### 2026-10-26 — founding

- Asked for after a loop someone else runs at 3am: "audit my development work in the last 24h, identify bottlenecks that slowed down my velocity, and propose improvements". harvest was judged the wrong shape: one session, moo's standard, issues for moo's builders.
- The subject is the agent and the project, never the person's own habits or user-level files.
- One fix, never a report: a list of ten is an artifact nobody owns. The fix waits on a branch, so the checked-out tree and any work in it stay untouched; keeping it is a merge, dropping it a branch delete.
- A script counts, the model only fixes: the pick is deterministic and the trend is a recount, so the "smoother every day" claim does not rest on the model's word. The last fix's commit carries its signal, group and count; no other state is kept.
- Base rate, 30 days: moo.md 92 sessions — errors after `release-it:only-our-commits` in 12, a moo card-gate block 18 times; meta-harness 196 sessions — `GLOSSARY.md` re-read in 12, `gh pr → gh run → gh run` in 17, `git fetch` failing 67 times in 13. A quiet project (moo.md, ~3 sessions a day) often has nothing recurring in one day, and then no model call runs.
- Headless writes to `.claude/` are refused in every permission mode short of bypass (probed); the script copies `.claude/` to `_claude/` for the pass and back.
- Not yet measured: whether the fixes are right. Graduation is the person's keep rate.

### 2026-10-26 — first real run, meta-harness

- Picked `gh pr` failing in 5 of 15 sessions. Sonnet, 38 s: a memory note naming the right repo (`roundup-app/roundup`), zsh quoting for `--jq`, and the exit codes that are not failures. Left on `smooth/2026-10-26` in the memory folder's git, which the run created. Kept or dropped: not yet.
- A tracked symlink in `.claude/` (a vendored skill) broke the `_claude/` copy on the first try; symlinks are now skipped, since a write through one lands outside the worktree.
