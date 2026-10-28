---
name: setup
description: Set the factory up on the current repo — the GitHub App, rules file, labels, auto-merge, and the worker.
disable-model-invocation: true
---

Set up the factory on the repo the session is in. `<root>` is the plugin root, two directories above this skill's base directory. Its dependencies are bundled: never run `bun install`.

## What the user wants

Run **hope:intent** on what this setup is for: a trial or a worker that stays up, and who besides the owner is trusted. More than one way to meet it remains → **hope:shape**.

## What stands in the way

Check each, then show the user every one that holds: what it would cause and the command that clears it. Run a command once the user agrees. Write nothing past this stage while any holds.

| Holds | Causes | Clears it |
|---|---|---|
| the default branch requires no status check: neither `gh api repos/<repo>/rules/branches/<base>` nor its branch protection names one, and neither does `protection.required_status_checks` in `gh api repos/<repo>/branches/<base>` | auto-merge merges unchecked code | require a check the repo already runs; it has none → propose one |
| the required check leaves branches free to be out of date: `strict_required_status_checks_policy` in each ruleset that requires one, and `required_status_checks.strict` in that protection, are false, and the gap below does not apply | two PRs green alone merge into a red base; the worker refuses to start | turn it on where the check is required |
| `bun` or `gh` is not on `PATH` | the worker can't start | `brew install bun gh` |
| Linux, and `bwrap` or `socat` is not on `PATH` | every run is sandboxed there, and its commands fail without them | `sudo apt install bubblewrap socat` |

With `pr.draft` true, the first two rows never hold: no PR auto-merges, and the worker checks neither.

The gap: `gh api repos/<repo>/branches/<base>/protection/required_status_checks` fails for this login, `branches/<base>` still names a required check, and no ruleset is strict. Nobody here can read whether that protection requires branches up to date, so the worker starts and logs a warning saying so. Tell the user; it does not stand in the way.

## The GitHub App

Done when `~/.config/factory/app.json` exists and `bun <root>/worker/cli.ts token`, run in the repo, prints a token. Otherwise only the user can get one. Whoever creates it sets:

- Webhook: Active unchecked.
- Repository permissions: Contents, Issues and Pull requests read and write; Checks, Commit statuses and Metadata read; no Workflows. Without Workflows, GitHub refuses the App any push that brings in a change to `.github/workflows/`, so once the base changes a workflow, each open PR behind it stalls until a person updates its branch. Tell the user.
- Installed on this repo only.

`gh repo view --json isInOrganization` says who creates it:

| The repo is | The App |
|---|---|
| the user's own (`false`) | the user creates it at https://github.com/settings/apps/new, installable only on their account, then installs it on this repo |
| an organization's (`true`) | the user can't create an App the organization installs: they ask the organization's admins for one the organization owns, and for its Client ID and a private key |

Save the private key as `~/.config/factory/app.pem`, mode 600. Write `~/.config/factory/app.json` as `{ "clientId": "<Client ID>", "key": "app.pem" }` and run `token` again.

## The rules file

Write `.claude/factory.json` with the user, every field `<root>/lib/rules.ts` defines. This must print nothing:

```sh
bun -e "const r=(await import('<root>/lib/rules.ts')).parseRules(await Bun.file('.claude/factory.json').text()); if ('errors' in r) { console.error(r.errors.join('\n')); process.exit(1) }"
```

- `bot`: the `name` that `token` prints.
- `trusted`: the logins intent named; never the bot.
- `atOnce`, `waitsPerDay`: ask. `contextCap` 300000 unless they name another; `paneEverySeconds` only if they name one.
- `taste`: `CLAUDE.md`, `AGENTS.md` and any taste file they name. Put every rule those files state on one of the `layers`:

  | Layer   | A rule that                                                                              |
  | ------- | ---------------------------------------------------------------------------------------- |
  | `check` | a machine can decide; **hope:anchor** writes the check, proposed and never added unasked |
  | `plan`  | shapes a design: types, modules, data flow                                               |
  | `judge` | needs judgment on the diff                                                               |
  | `none`  | no layer can hold                                                                        |

  A rule that reads two ways → **hope:clarify** before placing it. The user can't state their taste → **hope:elicit**. Show the mapping as a table and let the user move rules before writing it. Before each PR, a run runs every `check` entry and judges its diff by every `judge` rule; what it can't fix goes in the PR's body as unticked boxes.
- `sandbox`, only when runs need more than the default sandbox gives: `domains` for hosts such as a private package registry, `paths` for folders outside the worktree they write, such as a package store. Each path starts at `/` or `~/` and stays out of `~/.config/factory`.
- `worktree`, only when the repo has its own commands that lend worktrees, such as a pool: `create` and `release`, each an argv run with no shell from the main worktree. `create` gets `{name}` and prints the worktree's path last; `release` gets that path as `{dir}`. They run outside the sandbox, as the worker: a program the repo tracks, a run's PR can change, so name one from outside the repo. Without it, git adds each worktree beside the main one.
- `pr.draft`: true when a person marks each PR ready and merges it; the factory then never arms auto-merge.

Commit it on a branch and open a PR to the default branch.

## The repo

- `gh label create factory --force`, `gh label create factory:stuck --force` and `gh label create factory:undo --force`
- `gh repo edit --enable-auto-merge`, unless `pr.draft` is true
- Unless `~/.claude.json` has `projects["<repo path>"].hasTrustDialogAccepted` true, the user runs `claude` in the repo once and accepts the trust prompt.

## The worker

Start only once `git fetch origin && git show origin/HEAD:.claude/factory.json` prints the rules: the worker reads them from there, and the PR must merge first. A trial runs `bun <root>/worker/main.ts <repo path>` in their terminal. A worker that stays up runs that command with the absolute `bun` and the repo's main worktree path, restarts when it exits, starts at login, and gets a `PATH` of the directories of `bun`, `gh`, `claude` and `git` in this shell, and of each program the rules' `worktree` commands run:

| | macOS: launchd | Linux: systemd user unit |
|---|---|---|
| File | `~/Library/LaunchAgents/md.moo.factory.<repo name>.plist`: `ProgramArguments`, `EnvironmentVariables.PATH` (plus `caffeinate`'s directory), `KeepAlive` and `RunAtLoad` true | `~/.config/systemd/user/factory-<repo name>.service`: `ExecStart`, `Environment=PATH=…`, `Restart=always`, `WantedBy=default.target` |
| Load | `launchctl bootstrap gui/$(id -u) <plist>` | `systemctl --user enable --now factory-<repo name>`; `loginctl enable-linger` so it runs while logged out |
| Log | `StandardOutPath` and `StandardErrorPath`: `~/Library/Logs/factory-<repo name>.log` | `journalctl --user -u factory-<repo name>` |

Either way, the first output says `watching <repo>`, or a `factory:` line names what it refused.

## Done

State what was written and where, the rules on layer `none`, any check proposed and not added, and that an issue a trusted login writes and labels `factory` is picked up within a minute.
