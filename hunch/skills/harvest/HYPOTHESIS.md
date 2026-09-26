With `harvest` on, the steps the user keeps walking the agent through become a skill they chose to keep, with a measured score over no skill before they trust it.

Graduate when drafts the user kept beat the no-skill baseline across 5 real runs. Kill if the user deletes most drafts unread.

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
