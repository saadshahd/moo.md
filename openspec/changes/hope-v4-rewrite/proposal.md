## Why

hope v3.12.3 grew from a philosophy primer into a behavioral specification engine — 10 skills, ~1380 lines, DOT flowcharts, factory metaphors (criteria[], holdout[], satisfaction tuples, waves, zones). The philosophy is sound but the implementation buries it under machinery Claude now handles natively. The earliest hope (v0.0.1) was "the file is the philosophy" — a simple audit checklist that read like sticky notes from a senior dev. Platform evolution (Claude Code native task management, extended thinking, memory layers) made most of hope's execution machinery redundant. Time to return to the sticky notes.

## What Changes

**Skill reduction**: 10 skills / ~1380 lines → 5 skills / ~200 total lines.

- **BREAKING**: Remove `loop` — Claude Code handles task decomposition, execution tracking, and iteration natively. Encoding waves, satisfaction scoring, and carry semantics duplicates platform behavior.
- **BREAKING**: Remove `soul` — fold session strategy into `full`. The 174-line thinking framework with cognitive zones, verification gates, and per-turn audits over-engineers what a few pointed principles accomplish.
- **BREAKING**: Remove `verify` — trust Claude's native code review. A quality gate skill that runs 4 parallel specialists adds ceremony without proportional value.
- **BREAKING**: Remove `observe` — codebase health assessment (5 parallel assessors) is useful but not hope's job. On-demand, not pipeline infrastructure.
- **BREAKING**: Remove `forge` — persistent agent creation is a one-off task, not a pipeline skill. Agent files are simple enough to create directly.
- **BREAKING**: Remove `search` — sg/rg reference docs move to `docs/`. Reference material, not a skill.
- **Rewrite `intent`** — keep the clarification discipline (ask before building), drop the machinery (3-round MCQ, adversarial questions protocol, structured input scoring). ~30 lines.
- **Rewrite `shape`** — keep "decide HOW before building", drop criteria[]/holdout[]/mustNot[] separation, mode recommendations, feasibility filtering. ~30 lines.
- **Rewrite `consult`** — keep expert simulation with curated profiles, drop [EXTRACT]-only modes, severity machinery, coverage tiers. Panel debates stay. ~60 lines.
- **Rewrite `bond`** — absorb forge's creation responsibility. Bond designs teams AND spawns them, end-to-end. Drop 4-dimension fitness scoring formulas. ~40 lines.
- **New `full`** — absorbs soul's session awareness. Pipeline sequence in one file. ~40 lines.
- **Philosophy rewrite** — manifesto tone. Beliefs as 1-2 sentences of wisdom, not academic paragraphs. Recover v0.0.1 "sticky notes from a mentor" voice. Fold humble-master learnings (correction reception, cost asymmetry, advises/discloses/teaches).
- **New core principle**: prior art first — search before creating, reframe over replicate.
- **Hook simplification** — remove exit-plan-gate complexity, simplify PreCompact. Hooks that exist should be trivial to understand.
- **No factory metaphors**: no criteria[], mustNot[], holdout[], satisfaction tuples, waves, zones, DOT graphs anywhere.
- **Stack model**: hope (thinking) + OpenSpec (artifacts) + kit (tooling) + claude-mem (memory). Each plugin owns one layer.

## Capabilities

### New Capabilities

- `v4-skill-pipeline`: The 5-skill pipeline — intent (clarify WHAT), shape (decide HOW), consult (expert perspectives), bond (design + spawn teams), full (session strategy + pipeline sequence)
- `v4-philosophy`: Compressed manifesto-tone philosophy with recovered v0.0.1 values, humble-master integration, and "prior art first" principle
- `v4-hooks`: Simplified hook set — no exit-plan-gate sequential deny chain, minimal PreCompact

### Modified Capabilities

(No existing specs to modify — this is a ground-up rewrite.)

## Impact

- **hope plugin**: Every skill file rewritten or deleted. plugin.json version bump to 4.0.0.
- **PHILOSOPHY.md** (hope): Complete rewrite — manifesto tone, compressed beliefs, new principles.
- **PHILOSOPHY.md** (root): Update to reflect hope v4 identity.
- **CLAUDE.md** (root): Update skill pipeline docs, remove factory metaphor references, update hook table.
- **docs/statechart.md**: Simplify to match 5-skill pipeline.
- **Hooks**: Remove exit-plan-gate PreToolUse hook logic. Simplify PreCompact. SessionStart stays.
- **OpenSpec composition**: hope primes "propose a spec" naturally; OpenSpec picks up if installed. No hard coupling.
- **Marketplace**: Users on v3.x will need to update. Breaking change requires major version bump.
- **kit plugin**: No changes. Continues as independent tooling layer.
