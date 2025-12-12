# CLAUDE.md

## What This Is

moo.md — thoughtful plugins for Claude Code.

## Structure

```
moo.md/
├── hope/                    # Cognitive operating system
├── product/                 # PRDs, competitive analysis, metrics
├── wordsmith/               # Editing, voice, narrative
├── founder/                 # Startup validation, financials
├── career/                  # Interview prep, skill gaps
├── prompts/                 # Standalone prompt library
├── docs/                    # Documentation
└── scripts/install.sh       # Multi-tool installer
```

Each plugin follows:
```
<plugin>/
├── .claude-plugin/plugin.json
├── skills/<name>/SKILL.md
├── skills/<name>/references/
└── commands/<verb>.md
```

## Local Testing

```bash
# From parent directory:
/plugin marketplace add ./moo.md
/plugin install hope@moo.md
```

## Conventions

### Frontmatter (Required)

**Skills:**

```yaml
---
name: kebab-case-name
description: Single line. Trigger condition + what it does. Max 1024 chars.
version: 0.0.1
---
```

**Commands/Agents:**

```yaml
---
description: Single line. What it does and when to use it.
---
```

**WARNING:** Never use multi-line YAML blocks (`|` or `>`). Claude Code truncates them, breaking auto-triggering.

### File Naming

- Skills: `skills/<skill-name>/SKILL.md` (kebab-case)
- Commands: `commands/<verb>.md` (e.g., `plan.md`, `debug.md`)
- Agents: `agents/<role>.md` (e.g., `explorer.md`)

### Reference Files

- Place in `skills/<skill-name>/references/`
- One level deep only (no nested references)
- Keep SKILL.md under 500 lines; split to references if larger

### Token Efficiency

- Challenge every sentence: "Does Claude need this?"
- Bullet points > paragraphs
- No vague terminology; pick one term per concept
- Use forward slashes only (`/`), never backslashes

## Core Philosophy (Preserve These)

- **Confidence gates:** <70% research, 70-85% ship+monitor, ≥85% ship
- **Quality footer:** Confidence, Alternative, Reversible, Complexity
- **Workflows:** A=Build, B=Debug, C=Refactor
- **Learnings:** `~/.claude/learnings/*.jsonl`

## Anti-Patterns

- Generic names (`*Manager`, `*Helper`, `*Utils`)
- Nested reference chains (A → B → C)
- Time estimates instead of story points
- Windows paths or magic numbers in scripts

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

See `PHILOSOPHY.md` for core principles.
