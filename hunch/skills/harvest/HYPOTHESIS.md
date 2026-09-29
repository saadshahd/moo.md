With `harvest` on, every place a real session missed moo's standard — the agent asks only while stating intent and shape, then works on its own — becomes an issue a builder can act on without asking the reporter.

Graduate when builders act on 3 of the first 5 filed reports without asking the reporter. Kill if most draw follow-up questions, or turn out to be something moo already covers.

## Field notes

### 2026-09-26 — founding

- Hermes and Gemini mine sessions into skill drafts behind an inbox. Claude Code 2.1.282 added the measuring tools: `claude plugin init`, `claude plugin eval` (a no-plugin baseline arm by default), `claude plugin details`.
- `disable-model-invocation: true`: only the user knows a session held a procedure worth keeping.
- One procedure per run, split into moves: one skill and one eval case per step, taken from the real turn, plus a composer that calls them in order. An invented case would score a move on work the user never asked for. The first run's single `ship-to-main` skill bundled five steps, so its 0-vs-0 score could not say which step failed.

### 2026-09-26 — first real run, session `2fbddbb0`

- Named the release procedure ("merge only our needed file change on top of main", cleanup, update the plugin via Solo, check out origin main) as `ship-to-main`, in the user's words. The run cost $0.60, plus $1.20 for the eval.
- Scored 0/3 with the draft, 0/3 without. The eval's sandbox is an empty git folder: the branch, the other agent's commits and `origin` were not there, so neither arm had anything to merge. Bash was also withheld; the skill now passes `--allow-tools`.
- The scaffold declares the whole folder a skill path: `plugin details` counted no skill (~0 tok) and `evals/` overlapped the plugin's parts. Moving the skill to `skills/<name>/` gives ~72 tok always-on.
- Open: most procedures a session holds act on the repo the session ran in. Until the eval can see that repo, the score says nothing, and the graduation bar cannot pass.

### 2026-09-26 — second run, split into moves, same session

- Named `release-it`: four moves (`cut-release`, `only-our-commits`, `update-plugin`, `latest-origin-main`) and a composer; the worktree step and the restart note became composer lines. ~240 tok always-on. The run cost $0.78.
- No score: with Bash granted, every eval run stops at 0 turns. The eval refuses Bash while `~/.docker` holds a symlink, and Docker Desktop puts symlinks in `cli-plugins/` and `bin/lib/`. Pointing `DOCKER_CONFIG` at an empty folder does not help.
- Two move prompts ("check it to latest origin main", "merge only our needed…") are replies to the agent's last message. Alone, they give either arm too little to act on.

### 2026-09-26 — third run, eval only, and first real use

- With `~/.docker` moved aside for the run, all 30 eval runs executed ($3.73). Every case scored 0 with and 0 without: the sandbox held an empty repo, and the arms with the draft followed its steps for 5–8 turns, then asked where the plugin was.
- The user then used `release-it` for one real release and called it good: one run, not a rate, while its eval still cannot see a repo. The fold rule would have turned every move into a line on those 0-vs-0 scores, so a fold now needs a case that had everything it needed.
- The user rules where a draft goes: every session, this project, a plugin they own, another path, or nowhere. `claude plugin init` only writes to `~/.claude/skills/`, and a plugin folder under a project's `.claude/skills/` does not load, so the draft is built and scored in a scratch folder and moved on the user's pick.

### 2026-09-26 — redesign: report, never draft

- The user redesigned harvest: it reports where a session missed the standard, and builders solve. Skill drafting, eval cases, the repo bundle, `stage.sh` and scoring are gone.
- Why: four runs spent ~$16 to score drafts of one release procedure. The eval could not see the repo until the fourth run hand-staged it, and even then one case passed falsely and one could not score. The drafts measured the eval's limits more than the session.
- Kinds of miss live one per file in `kinds/`, so each deletes on its own; SKILL.md reads the folder.
- `read.sh` numbers the turns and marks skill calls, the first file change and every question, so a report cites turns a builder can open. `scrub.sh` blocks a draft that names the reporter's folders, repos, remotes, files or identity; filing is public.

### 2026-09-29 — #59 misread a pane's prompt as the user's

- #59 cited "Fix the slop findings" three times as the user repeating a step. The slop pane had filled that text in after the user reviewed findings. The transcript marks it typed, like the user's own words; only the pane's `Slop findings to fix:` attachment tells them apart. One misread in 24 filed reports, caught by one grep while judging it, so `read.sh` does not mark it.
- The same report listed hope 13.0.0, installed 39 minutes after the session began, while the pane behaved as the version before. `read.sh` now notes a plugin updated after the session began.
- Open: that session loaded every moo skill from the repo checkout, not the versioned install. For skills, the version line does not name what ran.
