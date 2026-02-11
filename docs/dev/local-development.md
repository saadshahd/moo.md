# Local Development

How to iterate on skills, commands, and hooks without reinstalling from marketplace.

## Dev Workflow

```bash
claude --plugin-dir ./moo.md
```

`--plugin-dir` loads the plugin directly from your source directory. Edits are the source of truth — no cached copy.

**Restart Claude Code after each edit.** No hot-reload or watch mode exists.

## Avoiding Duplicate Plugins

If you have `hope` installed from the marketplace, both versions load simultaneously — causing duplicate skills, commands, and hooks.

**Before dev sessions:**

```
/plugin disable hope@moo.md
```

**After dev sessions:**

```
/plugin enable hope@moo.md
```

Why not use settings files? `enabledPlugins` in `.claude/settings.local.json` **replaces** the entire object from lower-precedence scopes (not a deep merge). You'd need to replicate every enabled plugin entry — fragile.

## Isolation Testing

Strip all other plugins to test in a clean environment:

```bash
claude --plugin-dir ./moo.md --setting-sources project
```

This loads only project-level config + your dev plugin.

## Scenarios

| Scenario | Command |
|---|---|
| Dev with other plugins active | `claude --plugin-dir ./moo.md` |
| Dev in isolation | `claude --plugin-dir ./moo.md --setting-sources project` |
| Multiple dev plugins | `claude --plugin-dir ./moo.md --plugin-dir ./other` |
| Pre-release verification | `/plugin marketplace add ./moo.md` then `/plugin install` |

## Pre-Release Verification

Before pushing, test the marketplace install path to catch packaging issues:

```bash
/plugin marketplace add ./moo.md
/plugin install hope@moo.md
```

This copies files to `~/.claude/plugins/cache/` — the same path users experience.

## Git Hooks

Install the pre-push validation hook:

```bash
git config core.hooksPath .github/hooks
```

Validates: SKILL.md ≤ 200 lines, no `references/` dirs, frontmatter present, single-line descriptions.

## Known Issues

**Stale plugin cache** ([anthropics/claude-code#17361](https://github.com/anthropics/claude-code/issues/17361)): After `/plugin update`, the cache may not refresh. Force it:

```bash
rm -rf ~/.claude/plugins/cache/
```

Then reinstall.
