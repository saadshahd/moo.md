---
name: setup
description: Set the factory up on the current repo — the GitHub App, rules file, labels, auto-merge, and the worker.
disable-model-invocation: true
---

Set up the factory on the repo the session is in. `<root>` is the plugin root, two directories above this skill's base directory. Its dependencies are bundled: never run `bun install`.

## What the user wants

Run **hope:intent** on what this setup is for: a trial or a worker that stays up, and who besides the owner is trusted. More than one way to meet it remains → **hope:shape**.

## What stands in the way

Check each, then show the user every one that holds, with its fix. Apply a fix only once the user agrees; the user alone fixes their shell and installs tools or plugins. Write nothing past this stage while any holds.

| Holds | Fix |
|---|---|
| `ANTHROPIC_API_KEY` in the shell | the user unsets it where their shell sets it |
| `env.ANTHROPIC_API_KEY` or `apiKeyHelper` in `~/.claude/settings.json`, `.claude/settings.json` or `.claude/settings.local.json` | remove the key |
| `~/.claude/settings.json` lacks `env.CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` `"1"` | add it |
| `~/.claude/settings.json` enables no `factory@…` plugin | the user installs it with `/plugin` |
| the default branch requires no status check: neither `gh api repos/<repo>/rules/branches/<base>` nor its branch protection names one | require a check the repo already runs; it has none → propose one |
| `bun`, `gh`, `claude` or `wt` is not on `PATH` | the user installs it |
| the worker would run on Linux | none yet: the worker calls macOS-only `ioreg` and `caffeinate` |

## The GitHub App

Done when `~/.config/factory/app.json` exists and `bun <root>/worker/cli.ts token`, run in the repo, prints a token. Otherwise only the user can create it; walk them through https://github.com/settings/apps/new:

- Webhook: uncheck Active.
- Repository permissions: Contents, Issues and Pull requests read and write; Checks read.
- Installable only on their account; then install it on this repo only.
- Generate a private key; save it as `~/.config/factory/app.pem`, mode 600.

Write `~/.config/factory/app.json` as `{ "clientId": "<Client ID>", "key": "app.pem" }` and run `token` again.

## The rules file

Write `.claude/factory.json` with the user, every field `<root>/lib/rules.ts` defines. This must print nothing:

```sh
bun -e "const r=(await import('<root>/lib/rules.ts')).parseRules(await Bun.file('.claude/factory.json').text()); if ('errors' in r) { console.error(r.errors.join('\n')); process.exit(1) }"
```

- `bot`: the `name` that `token` prints.
- `trusted`: the logins intent named; never the bot.
- `atOnce`, `waitsPerDay`: ask. `contextCap` 300000 unless they name another; `paneEverySeconds` only if they name one.
- `taste`: `CLAUDE.md`, `AGENTS.md` and any taste file they name. Put every rule those files state on one layer:

  | Layer   | A rule that                                                                              |
  | ------- | ---------------------------------------------------------------------------------------- |
  | `check` | a machine can decide; **hope:anchor** writes the check, proposed and never added unasked |
  | `plan`  | shapes a design: types, modules, data flow                                               |
  | `judge` | needs judgment on the diff                                                               |
  | `none`  | no layer can hold                                                                        |

  A rule that reads two ways → **hope:clarify** before placing it. The user can't state their taste → **hope:elicit**. Show the mapping as a table and let the user move rules before writing it.

Commit it on a branch and open a PR to the default branch.

## The repo

- `gh label create factory --force` and `gh label create factory:stuck --force`
- `gh repo edit --enable-auto-merge`
- Unless `~/.claude.json` has `projects["<repo path>"].hasTrustDialogAccepted` true, the user runs `claude` in the repo once and accepts the trust prompt.

## The worker

Start only once `git fetch origin && git show origin/HEAD:.claude/factory.json` prints the rules: the worker reads them from there, and the PR must merge first. A trial runs `bun <root>/worker/main.ts <repo path>` in their terminal; a worker that stays up runs under launchd. For launchd write `~/Library/LaunchAgents/md.moo.factory.<repo name>.plist`:

- `ProgramArguments`: the absolute `bun`, `<root>/worker/main.ts`, the repo's main worktree path.
- `EnvironmentVariables.PATH`: the directories of `bun`, `gh`, `claude`, `wt`, `git` and `caffeinate` in this shell.
- `KeepAlive` and `RunAtLoad` true.
- `StandardOutPath` and `StandardErrorPath`: `~/Library/Logs/factory-<repo name>.log`.

Load it with `launchctl bootstrap gui/$(id -u) <plist>`. Either way, the first output says `watching <repo>`, or a `factory:` line names what it refused.

## Done

State what was written and where, the rules on layer `none`, any check proposed and not added, and that an issue a trusted login writes and labels `factory` is picked up within a minute.
