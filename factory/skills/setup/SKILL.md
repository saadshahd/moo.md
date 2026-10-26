---
name: setup
description: Set the factory up on the current repo — rules file, labels, auto-merge, and the worker under launchd on this Mac.
disable-model-invocation: true
---

Set up the factory on the repo the session is in. The plugin root is two directories above this skill's base directory; call it `<root>`.

## Refuse first
Stop and say why, changing nothing, when any holds:
- `ANTHROPIC_API_KEY` is set: it silently overrides the subscription.
- The default branch requires no status check (`gh api repos/<repo>/rules/branches/<base>` has no `required_status_checks` rule, and branch protection names no check). Auto-merge would merge unchecked code.
- `bun`, `gh`, `claude` or `wt` is missing from `PATH`.

## The rules file
Write `.claude/factory.json` with the user; `<root>/lib/rules.ts` is its schema and `parseRules` must accept the result.

1. Find where the project's taste lives: `CLAUDE.md`, `AGENTS.md`, and any taste or style file they name. These go in `taste`.
2. List every rule those files state. Put each on one layer:

   | Layer | Takes a rule that | Enforced by |
   |---|---|---|
   | `check` | a machine can decide | a required check; propose the check (hope:anchor writes it), never add it unasked |
   | `plan` | shapes a design: types, modules, data flow | the run's plan step |
   | `judge` | needs judgment on the diff | the run's PR comment; advice, never a gate |
   | `none` | no layer can hold | nothing; list them so the user sees the gap |

   Show the mapping as a table and let the user move rules before writing it.
3. Ask for `atOnce` (runs at once on this Mac) and `waitsPerDay` (asks a day that may wait for them). Set `contextCap` to 300000 unless they name another.
4. Write the file. The user commits it; the worker reads it from the main worktree.

## The repo
- `gh label create factory --force --description "Picked up by the factory worker"`
- `gh label create factory:stuck --force --color B60205 --description "A factory run gave up; the comment says why"`
- `gh repo edit --enable-auto-merge`
- `claude --bg` refuses a folder the user never trusted. If `claude` was never opened here, tell them to run `claude` in the repo once and accept the trust prompt.

## The worker
Write `~/Library/LaunchAgents/md.moo.factory.<repo name>.plist`:
- `ProgramArguments`: the absolute `bun`, `<root>/worker/worker.ts`, the repo's main worktree path.
- `EnvironmentVariables.PATH`: the directories holding `bun`, `gh`, `claude`, `wt`, `git` and `caffeinate`, read from this shell.
- `KeepAlive` true, `RunAtLoad` true.
- `StandardOutPath` and `StandardErrorPath`: `~/Library/Logs/factory-<repo name>.log`.

Load it: `launchctl bootstrap gui/$(id -u) <plist>`. Then read the log's first lines: `watching <repo>` means it runs; a `factory:` line names what it refused.

## Done
State what was written and where, the rules on layer `none`, any check proposed and not yet added, and that an issue labelled `factory` is now picked up within a minute.
