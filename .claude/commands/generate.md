---
description: Generate command/skill/agent files for moo.md ecosystem. Applies /prompt techniques automatically.
---

# /generate

Create production-ready `.md` files for the moo.md marketplace.

**Internally applies:** `/prompt` techniques to all generated content.

## Inputs

- `$1` — Type (command | skill | agent) or infer
- `$2` — Task description

## Ecosystem Structure

### Where Files Live

| Type    | Project-level              | Plugin-level                          |
| ------- | -------------------------- | ------------------------------------- |
| Command | `.claude/commands/X.md`    | `[plugin]/commands/X.md`              |
| Skill   | —                          | `[plugin]/skills/[name]/SKILL.md`     |
| Agent   | `.claude/agents/X.md`      | `[plugin]/agents/X.md`                |
| Ref     | —                          | `[plugin]/skills/[name]/references/`  |

### Plugin Architecture

```
[plugin]/
├── .claude-plugin/plugin.json    # name, version, description
├── skills/[name]/
│   ├── SKILL.md                  # Router, auto-triggers
│   └── references/*.md           # Supporting content
└── commands/*.md                 # User-invoked
```

### Frontmatter Rules

**Commands/Agents:**
```yaml
---
description: Single line. Max 1024 chars. No | or >.
---
```

**Skills:**
```yaml
---
name: kebab-case
description: Single line. Trigger + action.
version: 0.0.1
---
```

## Process

### Phase 1: Parse

- **What** — Core function (analyze, generate, debug, search, evaluate)
- **Where** — Project-level or plugin? Which plugin?
- **Type** — Command (explicit), Skill (background), Agent (delegated)

### Phase 2: Confidence Gate

| Confidence | Action                    |
| ---------- | ------------------------- |
| < 70%      | Ask ONE question, STOP    |
| 70-85%     | Add `## Assumptions`      |
| ≥ 85%      | Generate directly         |

### Phase 3: Type Detection

| Signal                                    | Type        |
| ----------------------------------------- | ----------- |
| "when I run", "command for"               | **Command** |
| "always apply", "principles", background  | **Skill**   |
| "search", "find", "analyze", delegatable  | **Agent**   |

Default → Command.

### Phase 4: Generate

Read `/prompt` and apply its techniques, then use ecosystem template:

#### Command Structure
```
# /[name]
[Purpose]
## When to Use
## Inputs
## Process (numbered steps)
## Output Format
## Examples
```

#### Skill Structure
```
# [Name]
[Philosophy]
## When This Applies
## Core Principles
## Process
## Anti-Patterns
```

#### Agent Structure
```
# [Name]
[Role + constraint]
## Delegation Trigger
## Strategy
## Output Format
```

## Conventions

- Replace "think" → "consider/evaluate/reason"
- Use "Use when..." not "MUST/CRITICAL"
- Story points, never time estimates
- Quality footer for non-trivial outputs
- Single-level references (no A→B→C chains)

## Post-Generation

1. State full file path
2. Verify frontmatter (single-line, no multi-line YAML)
3. Quality footer:

```
Confidence: X-Y%
Location: [file path]
Complexity: X story points
```
