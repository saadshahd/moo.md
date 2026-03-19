# CLAUDE.md

## What This Is

moo — mind on output. Stay present with AI. a Claude code plugin to help humans think clearly

## Conventions

### Frontmatter (Required)

**Skills:**

```yaml
---
name: kebab-case-name
description: Single line. Trigger condition + what it does. Max 1024 chars.
---
```

> **Note:** Version lives in `plugin.json` only (DRY). The official Claude Code spec does not allow `version` in SKILL.md frontmatter.

**DESCRIPTION TRAP WARNING:** Skill descriptions must be **trigger-only**. If descriptions contain process summaries or workflow steps, Claude follows the short description instead of reading the detailed flowchart/instructions. Keep descriptions focused on "Use when X" patterns only.

**Agents:**

```yaml
---
description: Single line. What it does and when to use it.
tools: Read, Glob, Grep, Bash
---
```

**WARNING:** Never use multi-line YAML blocks (`|` or `>`). Claude Code truncates them, breaking auto-triggering.

**Performance posture:** Agents must declare speed or thoroughness. Ambiguity defaults to thoroughness.

### File Naming

- Skills: `skills/<skill-name>/SKILL.md` (kebab-case)
- Agents: `agents/<role>.md` (e.g., `explorer.md`, `delve.md`)

### File Limits

- SKILL.md: **200 lines max**
- No `references/` directories — flat files alongside SKILL.md only when essential
- Supporting files: max 3 per skill (data files like profiles, templates)
- Self-contained: SKILL.md works without loading external files
- Decision tables > prose explanations
- No inline code examples > 5 lines
- No navigation/catalog sections in skills

### Token Efficiency

- Challenge every sentence: "Does Claude need this?"
- Bullet points > paragraphs
- No vague terminology; pick one term per concept
- Use forward slashes only (`/`), never backslashes

## Philosophy (Enforce These)

moo drives toward four outcomes: **reduce decision regret**, **increase conceptual clarity**, **leave fewer but stronger artifacts**, **preserve the capacity to own what you produce**. Every change to this project must serve at least one.

See `PHILOSOPHY.md` for core identity and mission.
See `hope/PHILOSOPHY.md` for hope beliefs, principles, and constraints.

### Philosophy Audit (Before Committing Changes)

- [ ] Does this add complexity without justification?
- [ ] Does this introduce persistent state?
- [ ] Could an existing skill handle this?
- [ ] Does this build something Claude does natively?
- [ ] Does this serve at least one aim: reduce regret / increase clarity / fewer artifacts / preserve ownership?

See `<plugin>/PHILOSOPHY.md` for plugin-specific audit items.

## Anti-Patterns

- Generic names (`*Manager`, `*Helper`, `*Utils`)
- Reference chains or deep `references/` hierarchies
- Time estimates instead of story points
- Duplicating content across docs (link to single source) — **exception:** constraints that must survive compaction repeat at point of use
- Windows paths or magic numbers in scripts
- **Process details in skill descriptions** (causes Claude to skip flowcharts)
- Inline examples longer than 5 lines
- Navigation/catalog sections in skills (tool indexes, skill tables)
- Skills over 200 lines
- Persistent state files (.jsonl, workflow-state.json)
- Task management APIs in skills (TaskCreate/TaskList/TaskUpdate)
- Building features Claude Code will ship natively (task management, memory, tool orchestration)
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
- Tag the release

**IMPORTANT:** Before any commit, check if CHANGELOG.md needs an entry. If the change is user-facing (new feature, fix, breaking change), add it.

See `PHILOSOPHY.md` for core identity and mission.
See `hope/PHILOSOPHY.md` for hope pipeline philosophy.
