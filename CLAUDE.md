# CLAUDE.md

## What This Is

moo.md — thoughtful plugins for Claude Code.

## Plugin Structure

```
moo.md/                            # Marketplace (can host multiple plugins)
├── .claude-plugin/marketplace.json
├── philosophy/                    # First plugin
│   ├── .claude-plugin/plugin.json
│   ├── skills/<skill-name>/
│   │   ├── SKILL.md
│   │   └── references/
│   ├── commands/<command>.md
│   ├── agents/<agent>.md
│   ├── hooks/hooks.json
│   └── scripts/
└── <future-plugin>/               # Add more plugins here
```

## Local Testing

```bash
# From parent directory:
/plugin marketplace add ./moo.md
/plugin install philosophy@moo.md
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
