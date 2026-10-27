---
name: setup
description: Set the factory up on the current repo — the GitHub App, rules file, labels, auto-merge, and the worker on this Mac.
disable-model-invocation: true
---

Set up the factory on the repo the session is in. `<root>` is the plugin root, two directories above this skill's base directory. Its dependencies are bundled: never run `bun install`.

## Refuse
Change nothing and say which holds:
- `ANTHROPIC_API_KEY` is set in the shell, or `env.ANTHROPIC_API_KEY` or `apiKeyHelper` is set in `~/.claude/settings.json`, `.claude/settings.json` or `.claude/settings.local.json`.
- `~/.claude/settings.json` lacks `env.CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` `"1"`, or enables no `factory@…` plugin.
- The default branch requires no status check: neither `gh api repos/<repo>/rules/branches/<base>` nor its branch protection names one.
- `bun`, `gh`, `claude` or `wt` is not on `PATH`.

## The GitHub App
Done when `~/.config/factory/app.json` exists and `bun <root>/worker/cli.ts token`, run in the repo, prints a token. Otherwise only the user can create it; walk them through https://github.com/settings/apps/new:
- Webhook: uncheck Active.
- Repository permissions: Contents, Issues and Pull requests read and write; Checks read.
- Installable only on their account; then install it on this repo only.
- Generate a private key; save it as `~/.config/factory/app.pem`, mode 600.

Write `~/.config/factory/app.json` as `{ "clientId": "<Client ID>", "key": "app.pem" }` and run `token` again.

## The rules file
Write `.claude/factory.json` with the user, every field `<root>/lib/rules.ts` defines; `parseRules` must accept it.
- `bot`: the `name` that `token` prints.
- `trusted`: ask; never the bot.
- `atOnce`, `waitsPerDay`, `paneEverySeconds`: ask. `contextCap`: 300000 unless they name another.
- `taste`: `CLAUDE.md`, `AGENTS.md` and any taste file they name. Put every rule those files state on one layer:

  | Layer | A rule that |
  |---|---|
  | `check` | a machine can decide; **hope:anchor** writes the check, proposed and never added unasked |
  | `plan` | shapes a design: types, modules, data flow |
  | `judge` | needs judgment on the diff |
  | `none` | no layer can hold |

  A rule that reads two ways → **hope:clarify** before placing it. The user can't state their taste → **hope:elicit**. Show the mapping as a table and let the user move rules before writing it.

Commit it on a branch and open a PR to the default branch. The worker reads the rules from `origin`, so it can't start until the PR merges.

## The repo
- `gh label create factory --force` and `gh label create factory:stuck --force`
- `gh repo edit --enable-auto-merge`
- Unless `~/.claude.json` has `projects["<repo path>"].hasTrustDialogAccepted` true, the user runs `claude` in the repo once and accepts the trust prompt.

## The worker
Ask: a foreground trial, `bun <root>/worker/main.ts <repo path>` in their terminal, or launchd. For launchd write `~/Library/LaunchAgents/md.moo.factory.<repo name>.plist`:
- `ProgramArguments`: the absolute `bun`, `<root>/worker/main.ts`, the repo's main worktree path.
- `EnvironmentVariables.PATH`: the directories of `bun`, `gh`, `claude`, `wt`, `git` and `caffeinate` in this shell.
- `KeepAlive` and `RunAtLoad` true.
- `StandardOutPath` and `StandardErrorPath`: `~/Library/Logs/factory-<repo name>.log`.

Load it with `launchctl bootstrap gui/$(id -u) <plist>`. Either way, the first output says `watching <repo>`, or a `factory:` line names what it refused.

## Done
State what was written and where, the rules on layer `none`, any check proposed and not added, and that an issue a trusted login writes and labels `factory` is picked up within a minute.
