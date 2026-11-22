---
name: hum
description: Set hum up in this repo, or change how it is set up. Reads the repo, proposes every setting, asks only what you alone hold, writes .hum/hum.json, adds a check tool's ignore line for the slot folder where you say yes, and proves it on a scratch copy.
disable-model-invocation: true
---

Read first, then ask. Every question leads with what the repo showed and a proposal to accept or change.

## Read

Run `bunx hum setup scan` (the pinned engine: `bun add --exact @moo.md/hum@<version>` first if `package.json` has none). It prints the scan, a proposal for each setting, the waiting states, how many open issues the label map covers, and `gitIdentity`: the name and email hum will commit as, read from your git config. Where the base requires signed commits, GitHub makes hum's commits and credits them to the token's account instead: yours on a Mac, the App's bot in CI. If `gitIdentity.found` is false, stop: tell the owner to set the `missing` keys with `git config --global <key> "<value>"` and ask nothing more. Answer nothing from the scan that the repo already says.

## Ask

Ask in this order. One question per turn, each with its proposal. Where a question is open-ended, call **hope:elicit**; where the answer is a rule others must apply the same way, call **hope:anchor**; where a setting steers unattended work, call **hope:target**.

| Ask | Proposal comes from | The answer sets |
| --- | --- | --- |
| Where runs happen: your Mac, CI, or both | the scan: CI workflows, a service unit; with roundup Todos, your Mac alone, as setup refuses CI | `runPlaces` |
| Where items, questions and answers live: GitHub issues, markdown files in `itemsDir`, or roundup Todos | `integrations` in the proposal: GitHub where the repo has open issues or an issue template. An issue is ready once it carries `readyLabel`; hum leaves one a person is assigned to, or an open pull request closes. Offer roundup where `RUPD_SOCKET` is set in this shell: a Todo is ready once it is open and unblocked in the root Workstream `roundupWorkstream` names, where the owner puts what hum should build; hum moves each Todo it takes into a Workstream of its own, "#<id> <title>", and files its follow-ups back into the named one | `integrations`, `roundupWorkstream` |
| Which commands a change must pass | CI jobs on pull requests, else package scripts, after the lockfile install a fresh clone needs | `checks` |
| Whether every change lands through a pull request, even where the base takes a push | the base's rules, from `gh api repos/<owner>/<repo>/rules/branches/<base>`: where they require status checks and no pull request, a push from a token that may bypass them skips the checks; propose `true` there, else `false` | `alwaysPullRequest` |
| Which label a pull request needs when it grows some files | `labelGates` in the proposal: a repo label a job quotes, in a workflow that runs again when a pull request gets a label. Read that job. Where it fails a pull request that grows the bytes of some files and lacks the label, write one entry per set of files it sums apart, with globs that match exactly those files | `growthLabels` |
| For CI runs: the repo's setting "Allow GitHub Actions to create and approve pull requests" | `workflowsMayOpenPullRequests` in the scan; if off, ask the owner to turn it on and never change it yourself; `null` where the scan could not read it, as anyone but a repo admin cannot: ask the owner to check it | nothing written |
| For CI runs: the runner, job container and env the wake's jobs run with | `wakeJob` in the proposal: the job that runs Claude Code, else the pull request job; drop env only that job uses. The image needs git, node and npm; one that runs as root needs `IS_SANDBOX` set to `1` in `ciEnv`. An env value that reads a secret reaches only the step that runs hum | `ciRunner`, `ciContainer`, `ciEnv` |
| For CI runs, when the owner names a runner GitHub does not host and `isPublicRepo` in the scan is not `false`: whether wakes may run there | the proposal never names one; such a machine keeps what a job leaves, so a process a run started could outlive the work job and reach the next job there, which holds GitHub's token; recommend ephemeral runners | `"ownRunnerOnPublicRepo": true` beside `hum` in the answers, only on the owner's yes |
| For CI runs: how Claude Code signs in | `wakeJob.ciClaudeAuth`: the `CLAUDE_CODE_OAUTH_TOKEN` secret, or `env` where `ciEnv` carries the credentials, such as a gateway's settings | `ciClaudeAuth` |
| For CI runs: how a pull request's required checks start | a pull request opened with the workflow token starts no workflows, and dispatching the check workflow does not satisfy the required check; ask for a GitHub App with contents, issues and pull requests write, whose two secrets `wakeJob.pullRequestToken` names where a workflow already mints a token, or a fine-grained token's secret | `pullRequestToken` |
| One question per waiting state: after how many hours it times out, and so goes to its `leadsTo` state | `waits` in the scan | `waitHours` |
| What each folder's risk is | folder history and names | `paths`, `strictPaths` |
| Which paths hold data or secrets | the scan's matches | `strictPaths` |
| How many merged changes judge a fix or a measure | the shipped windows | `changeLabels.fixWindow`, `measureWindow` |
| Which label means which kind | issue-template labels and repo labels | `kindLabels` |
| Which kind an item takes when no label and no `Kind:` line name one | the work source: where its items never carry labels, as roundup Todos, the kind most of them are; else `null`, so the cheap model call picks and asks when unsure | `defaultKind` |
| Services and setup each run slot needs | compose file, env script, install command | `runSlots` |
| One question per check tool that reads the pool folder, where run slots are on and the pool lies inside the checkout: the tool's ignore line for the pool | slots are on where `runSlots.enabled` is true or `integrations` names roundup; the pool is `runSlots.pool` as settled: the proposal's, unless `.hum/hum.json` or the owner names another; each command in `checks`, as the paragraph below reads it | the tool's ignore entry for the pool, written in that tool's own config, outside the answers file, only on the owner's yes |
| Whether items with no `touches:` line run beside others, and how many times a change another run beat to the same files is built again | the work source: where items never name their files, as roundup Todos, run them side by side with one rebuild; else keep them alone | `undeclaredRunsAlone`, `conflictRebuilds` |
| Which files every review reads beside the diff | the repo's rules files, such as `AGENTS.md`; an item adds its own on a `reads: a, b` line | `reviewReads` |
| When `ciClaudeAuth` is `oauth-token`: the date the CI token expires, after `claude setup-token` | only the owner holds it | a reminder the owner keeps |

A check run from the checkout can walk every slot in the pool: `.git/info/exclude` hides the pool from git, and a tool skips it only where it honours that file or a rule in its config does. For each command in `checks`, follow it through package scripts and wrappers to its tool, then read each config the command loads, and the tool's defaults and docs, for whether the tool walks the pool. A tool given its files or folders by name does not. One whose defaults and configs show it takes every folder they do not skip by name does. One whose handling of `.git/info/exclude` they leave open goes to the probe: add `/<pool>/` to `.git/info/exclude`, run `git worktree add --detach <pool>/probe origin/<base>` (the base branch the scan ran with), break in it one file for each tool you probe, run each command from the checkout, and count a path under the pool in its output as the tool reading the pool. Then run `git worktree remove --force <pool>/probe`; leave the exclude line, which hum adds itself. For each config whose tool reads the pool, name the config file and propose the one entry that config uses to skip a path.

Say what the labels cover: "`kindLabels` covers N of M open issues; the rest get `defaultKind`, or where it is `null` the fallback kind and one question."

Where runs include CI and `isPublicRepo` is not `false`, tell the owner that anyone can read `refs/hum/state`, where each wake keeps hum's state: plans, answers and the output of failed checks.

Where runs include CI, tell the owner what a wake's three jobs hold. `gather` and `publish` hold GitHub's token and run hum from npm, with none of the repo's code. `work` runs the runs and the repo's checks with no GitHub token, but it holds the Actions token its artifact upload needs, so a run there could write the Actions cache on the default branch for any workflow that restores it. Publish checks that the commit identity commits each new commit and writes it, unless a rebase kept the author of a commit gather handed on, but the work job writes those names itself: what holds against a hostile work job is that publish writes only hum's own branches and places every change from its own diff and config.

## Write

1. Write the answers as JSON: `{ "hum": {settings}, "waitHours": { "kind/state": hours }, "schemaVersion": 3 }`. Where `integrations` names roundup, set `runSlots.enabled` to true: every run there is a Rail row in a run slot.
2. Run `bunx hum setup write --answers <file>`. A refusal writes nothing: relay its message, which names the fix. Where `integrations` names roundup, write prints `program` in place of a service unit. Only the owner may name the Project's program, so hand them that step whole: open `program.open`, enter each of `program.fields` as printed, a blank `Folder` left blank, then `program.start`. roundup then runs hum serve, starts it again after any exit, and shows hum's status on its row; while the Program differs from what setup printed, the row names the difference and no worker starts. hum serve builds every open Todo in the root Workstream `roundupWorkstream` names. Make that Workstream where the Project lacks it; the owner puts there the Todos hum should build. `hum serve` restarts `hum work` after a crash; after an update that installs another engine, it exits, and roundup starts it again on the new one.
3. Run `bunx hum setup measure` to record each model's pass rate, so a check that cannot yet be trusted reports instead of gating. Tell the owner: once a role file or a judge's prompt changes, the Mac worker measures that judge again, spending live calls, and writes the new rate into `.hum/hum.json`. The old rate gates until then, and in CI until they commit the file.
4. Run `bunx hum setup prove`. Add `--item` only after the owner agrees to the live calls it spends.

End by stating what is now written, which proofs passed, and which were skipped and why.
