## Why

Claude has CLAUDE.md principles loaded in every conversation but doesn't reliably apply them as a deliberate final audit pass. Users need an explicit invocation point — the same way `consult` creates a deliberate "get expert perspectives" moment, `distill` creates a deliberate "stop and audit against principles" moment. Without this, principled review happens inconsistently or not at all.

## What Changes

- Add `distill` agent to the hope plugin — the first agent (subagent) in hope
- Agent audits recent work against 6 universal engineering principles: Musashi (nothing unused), library-first, fail loud, state hygiene, atomic changes, observer (verification defined)
- Agent uses persistent project-scoped memory to accumulate conventions and dismissed findings across sessions
- Agent works from git diff and file reads (no conversation context — isolated audit)

## Capabilities

### New Capabilities

- `principled-audit`: A post-implementation audit agent that checks recent changes against universal engineering principles, with persistent memory that learns project conventions over time

### Modified Capabilities

- `thinking-discipline`: Hope gains a post-implementation stage (distill) alongside its pre-implementation stages (intent, shape, consult, bond)

## Impact

- `hope/agents/distill.md` — new file (already created and reviewed)
- `hope/.claude-plugin/plugin.json` — version bump to 4.1.0
- `CHANGELOG.md` — new entry under [Unreleased]
- Hope plugin description may need updating to reflect the new agent capability
- No breaking changes — additive only
