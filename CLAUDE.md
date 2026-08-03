# CLAUDE.md

## What This Is

moo — *mind on output*. A Claude Code plugin that helps humans stay present and think clearly while working with AI.

## Conventions

Authoring doctrine for this repo's own skills, fragments, hooks, and runtime files lives in the `moo-authoring` skill, which fires when you add or change one. What stays here is the set whose violation produces no error.

**Description scope.** A skill's `description` carries the selection decision — what makes the skill fire — and its body carries the procedure. That is a placement rule, not a claim about how much a description can hold: the description is the only text present when the selection decision is made, and execution guidance either duplicates the body or loads in every session to serve a minority of them. A skill with `disable-model-invocation: true` is the exception the rule predicts: nothing selects it, so its description is an invocation summary for the human.

**YAML.** Multi-line YAML blocks (`|`, `>`) in frontmatter are truncated by Claude Code, which silently breaks auto-triggering.

**Hooks always fail open:** exit 0 with valid JSON on any error. A hook that fails closed silently disables itself for every future session.

> **Enforcement:** the sync-drift guard (`.githooks/pre-push`) is the repo's only mechanical doc gate, and it sees inlined fragment blocks and nothing else — no shell file in this repo is checked by anything.

## Philosophy

moo drives toward four outcomes: **reduce decision regret**, **increase conceptual clarity**, **leave fewer but stronger artifacts**, **preserve the capacity to own what you produce**. Every change to this project must serve at least one.

See `PHILOSOPHY.md` for core identity and mission.
See `hope/PHILOSOPHY.md` for hope beliefs, principles, and constraints — including "Hard Constraints" for plugin-specific audit items.

### Model-Judgment Boundaries

A skill or hook that leans on a model's judgment (a judge, a generated artifact, an LLM check) has a correctness **rate**, not a guarantee. Its failure mode is a confident, valid-shaped wrong answer no enumerable error case names.

- NEVER claim such a boundary "works" from a single run, or model its failures as a finite set you've "handled."
- DO fence it with a deterministic check where one exists, and measure its pass-rate on a labeled set before trusting it (`seed`'s eval workspace IS this; a `slop-nudge`-style judge NEEDS it).

## Anti-Patterns

- Reference chains — a file whose content is a pointer to another file. A parent naming children that load on their situation is the opposite, and is how deferral works.
- No wall-clock estimates of the agent's own work.
- Duplicating content across docs (link to single source) — **exception:** a constraint may repeat at point of use when the two copies are separated by a compaction boundary, i.e. a long-running agent whose early context will be summarized away. Two copies that co-load in one context window are duplication with no exception available.
- Windows paths in scripts.
- Inline examples that narrow the exploration space — a specimen of desired output rather than a case that fixes the meaning of a term or marks where a property stops holding.
- Catalogs of what the harness already enumerates (tool indexes, skill tables) — not a parent routing to its own children.
- Persistent work/pipeline state files (.jsonl, workflow-state.json) — conversation markers only
- Task management APIs in skills (TaskCreate/TaskList/TaskUpdate)
- Building features Claude Code will ship natively (task management, memory, tool orchestration) — compete on thinking quality
- Cargo cult process steps (ritual without reason)
- Optimizing for output volume while degrading human comprehension
- Automating friction that builds understanding (edge case exploration, consequence engagement)
- Parallel agent sessions that exceed the human's attention span (8 sessions open, 1/8 attention each)

## Changelog

Track all changes in `CHANGELOG.md` at repo root.

**When committing:**

- Add entry under `[Unreleased]` section
- Use categories: Added, Changed, Fixed, Removed
- Reference plugin name in entry (e.g., "feat(hope): ...")

**When releasing:**

- Move unreleased items to new version section
- Update version in affected plugin.json files
- Run `bun run sync` and verify both a zero exit code and a clean git diff on every consumer SKILL.md. Consumers are discovered, not listed — `node scripts/sync.js --list` prints them; don't trust a hand-copied list here.
- The sync-drift guard runs only when `core.hooksPath=.githooks` AND the hook file is executable. Verify the target, not the pointer: `[ -x .githooks/pre-push ]`. Its `TARGETS` comes from `sync.js --list`, so it covers every consumer without being told about one.
- One-time setup: `git config core.hooksPath .githooks`

**IMPORTANT:** Before any commit, check if CHANGELOG.md needs an entry. If the change is user-facing (new feature, fix, breaking change), add it.
