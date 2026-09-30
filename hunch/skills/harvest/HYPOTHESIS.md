With `harvest` on, every place a real session missed moo's standard — the agent asks only while stating intent and shape, then works on its own — becomes an issue a builder can act on without asking the reporter.

Graduate when builders act on 3 of the first 5 filed reports without asking the reporter. Kill if most draw follow-up questions, or turn out to be something moo already covers.

## Field notes

### 2026-09-26 — redesign: report, never draft

- The user redesigned harvest: it reports where a session missed the standard, and builders solve. Skill drafting, eval cases, the repo bundle, `stage.sh` and scoring are gone.
- Why: four runs spent ~$16 to score drafts of one release procedure. The eval could not see the repo until the fourth run hand-staged it, and even then one case passed falsely and one could not score. The drafts measured the eval's limits more than the session.
- `disable-model-invocation: true`: only the user knows a session held a procedure worth keeping.
- Kinds of miss live one per file in `kinds/`, so each deletes on its own; SKILL.md reads the folder.
- `read.sh` numbers the turns and marks skill calls, the first file change and every question, so a report cites turns a builder can open. `scrub.sh` blocks a draft that names the reporter's folders, repos, remotes, files or identity; filing is public.

### 2026-09-29 — #59 misread a pane's prompt as the user's

- #59 cited "Fix the slop findings" three times as the user repeating a step. The slop pane had filled that text in after the user reviewed findings. The transcript marks it typed, like the user's own words; only the pane's `Slop findings to fix:` attachment tells them apart. One misread in 24 filed reports, caught by one grep while judging it, so `read.sh` does not mark it.
- The same report listed hope 13.0.0, installed 39 minutes after the session began, while the pane behaved as the version before. `read.sh` now notes a plugin updated after the session began.
- Open: that session loaded every moo skill from the repo checkout, not the versioned install. For skills, the version line does not name what ran.
