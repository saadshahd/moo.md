---
name: setup
description: Set the factory up on the current repo — the rules file, labels, auto-merge, and the worker.
disable-model-invocation: true
---

Set up the factory on the repo the session is in. `<root>` is the plugin root, two directories above this skill's base directory. Its dependencies are bundled: never run `bun install`.

## What the user wants

Run **hope:intent** on what this setup is for: a trial or a worker that stays up, and who besides the owner is trusted. More than one way to meet it remains → **hope:shape**.

## What stands in the way

Check each, then show the user every one that holds: what it would cause and the command that clears it. Run a clear that touches only this repo's working tree (a stale lock, a leftover file) yourself, once the repo's own note confirms it, and report it cleared; run one that changes GitHub settings or installs software on the machine once the user agrees. Write nothing past this stage while any holds.

| Holds | Causes | Clears it |
|---|---|---|
| the default branch requires no status check: neither `gh api repos/<repo>/rules/branches/<base>` nor its branch protection names one, and neither does `protection.required_status_checks` in `gh api repos/<repo>/branches/<base>` | auto-merge merges unchecked code | require a check the repo already runs; it has none → propose one |
| the required check leaves branches free to be out of date: `strict_required_status_checks_policy` in each ruleset that requires one, and `required_status_checks.strict` in that protection, are false, and the gap below does not apply | two PRs green alone merge into a red base; the worker refuses to start | turn it on where the check is required |
| `bun` or `gh` is not on `PATH` | the worker can't start | `brew install bun gh` |

With `pr.draft` true, the first two rows never hold: no PR auto-merges, and the worker checks neither.

The gap: `gh api repos/<repo>/branches/<base>/protection/required_status_checks` fails for this login, `branches/<base>` still names a required check, and no ruleset is strict. Nobody here can read whether that protection requires branches up to date, so the worker starts and logs a warning saying so. Run any read the repo ships for it and give the user its result with the warning; it does not stand in the way.

## The GitHub login

The worker and its runs act as the user's own `gh` login: every claim, comment, push and PR carries the user's name. Done when `gh auth status` shows that login with the `repo` scope, authorized for the organization's single sign-on where it has one.

GitHub refuses an author's approval of their own PR, so where the default branch requires a review, someone other than the user approves each factory PR. Tell the user, and say so in the rules PR, so the people who review know these PRs come to them.

## The rules file

Write `.claude/factory.json` with the user, every field `<root>/lib/rules.ts` defines. This must print nothing:

```sh
bun -e "const r=(await import('<root>/lib/rules.ts')).parseRules(await Bun.file('.claude/factory.json').text()); if ('errors' in r) { console.error(r.errors.join('\n')); process.exit(1) }"
```

- `trusted`: the logins intent named; never a bot.
- `atOnce`, `waitsPerDay`: ask. Read the runbook and repo docs first: a figure they state is the answer, and the user is asked only for one nothing states. `contextCap` 300000 unless they name another; `paneEverySeconds` only if they name one.
- `taste`: `CLAUDE.md`, `AGENTS.md` and any taste file they name. Put every rule those files state on one of the `layers`:

  | Layer   | A rule that                                                                              |
  | ------- | ---------------------------------------------------------------------------------------- |
  | `check` | a machine can decide; **hope:anchor** writes the check, proposed and never added unasked |
  | `plan`  | shapes a design: types, modules, data flow                                               |
  | `judge` | needs judgment on the diff                                                               |
  | `none`  | no layer can hold                                                                        |

  A rule that reads two ways → **hope:clarify** before placing it. The user can't state their taste → **hope:elicit**. Show the mapping as a table and let the user move rules before writing it. Before each PR, a run runs every `check` entry and judges its diff by every `judge` rule; what it can't fix goes in the PR's body as unticked boxes.
- `worktree`, only when the repo has its own commands that lend worktrees, such as a pool: `create` and `release`, each an argv run with no shell from the main worktree. `create` gets `{name}` and prints the worktree's path last; `release` gets that path as `{dir}`. They run as the worker: a program the repo tracks, a run's PR can change, so name one from outside the repo. Without it, git adds each worktree beside the main one.
- `pr.draft`: true when a person marks each PR ready and merges it; the factory then never arms auto-merge.

Commit it on a branch and open a PR to the default branch.

## The repo

- `gh label create factory --force`, `gh label create factory:stuck --force` and `gh label create factory:undo --force`
- `gh repo edit --enable-auto-merge`, unless `pr.draft` is true
- Claude Code starts a background run only in a folder whose trust prompt was accepted: the repo, and each folder the rules' `worktree` `create` command can lend, such as a pool's slots. For each, unless `~/.claude.json` has `projects["<path>"].hasTrustDialogAccepted` true (read it yourself and report which hold), the user runs `claude` there once and accepts the prompt.

## The worker

Start only once `git fetch origin && git show origin/HEAD:.claude/factory.json` prints the rules: the worker reads them from there, and the PR must merge first. A trial runs `bun <root>/worker/main.ts <repo path>` in their terminal. A worker that stays up runs that command with the absolute `bun` and the repo's main worktree path, restarts when it exits, starts at login, and gets a `PATH` of the directories of `bun`, `gh`, `claude` and `git` in this shell, and of each program the rules' `worktree` commands run:

| | macOS: launchd | Linux: systemd user unit |
|---|---|---|
| File | `~/Library/LaunchAgents/md.moo.factory.<repo name>.plist`: `ProgramArguments`, `EnvironmentVariables.PATH` (plus `/usr/bin:/bin:/usr/sbin:/sbin`, where `caffeinate` and `ioreg` live), `KeepAlive` and `RunAtLoad` true | `~/.config/systemd/user/factory-<repo name>.service`: `ExecStart`, `Environment=PATH=…`, `Restart=always`, `WantedBy=default.target` |
| Load | `launchctl bootstrap gui/$(id -u) <plist>` | `systemctl --user enable --now factory-<repo name>`; `loginctl enable-linger` so it runs while logged out |
| Log | `StandardOutPath` and `StandardErrorPath`: `~/Library/Logs/factory-<repo name>.log` | `journalctl --user -u factory-<repo name>` |

Either way, the first output says `watching <repo>`, or a `factory:` line names what it refused.

## Done

State what was written and where, the rules on layer `none`, any check proposed and not added, and that an issue a trusted login writes and labels `factory` is picked up within a minute.
