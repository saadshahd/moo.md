# CLAUDE.md

## What This Is

moo — mind on output. Stay present with AI.

## Structure

```
moo.md/
├── hope/                    # Single plugin: 5 skills, 6 commands, hooks
│   ├── skills/
│   │   ├── soul/            # Session strategy + thinking framework
│   │   ├── intent/          # Clarify WHAT
│   │   ├── shape/           # Decide HOW (consult-driven)
│   │   ├── loop/            # Execute + verify + complete
│   │   └── consult/         # Expert simulation (42 profiles)
│   ├── commands/            # panel, summon, block, unblock, blocked, intent
│   ├── hooks/               # UserPromptSubmit + SubagentStart
│   └── scripts/             # Per-turn session strategy injector
├── prompts/                 # Standalone prompt library
├── docs/                    # User docs
├── eval/                    # Skill evaluation tests
└── .github/hooks/           # Git hooks (pre-push runs evals)
```

Plugin follows:

```
hope/
├── .claude-plugin/plugin.json    # name, version, description, keywords, author
├── skills/<name>/SKILL.md
└── skills/<name>/[data files]    # profiles/ — flat alongside SKILL.md
```

Plugin discovery uses `.claude-plugin/marketplace.json` at repo root.

## Skill Pipeline

```
intent (clarify WHAT) → shape (decide HOW) → loop (execute + verify) → consult (expert guidance)
```

Session strategy (in soul) auto-detects type (Build/Debug/Plan/Reflect) and asks engagement level (Autonomous/Collaborative/Guided). The `[SESSION]` marker persists through compaction.

## Local Testing

```bash
# From parent directory:
/plugin marketplace add ./moo.md
/plugin install hope@moo.md
```

## Evaluations

Run `bun run eval/run.ts hope` to test skill triggering. Pre-push hook runs evals automatically.

**When adding skills:** Add test case YAML to `hope/eval/cases/`.

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

### DOT Notation (Graphviz)

Use DOT for process documentation. Claude follows DOT-written processes more reliably than prose.

**When to use:**
- Non-obvious decision points
- Process loops or cycles
- Multi-path workflows with branching

**When NOT to use:**
- Linear instructions (use numbered lists)
- Code examples (embed code directly)
- Simple single-path processes

**Direction conventions:**
- `rankdir=TB` — Hierarchical decisions, top-down flows
- `rankdir=LR` — Cyclic processes, state machines, retry loops

**Color palette:**
| Color | Hex | Usage |
|-------|-----|-------|
| Blue | `#e6f3ff` | Start/input nodes |
| Orange | `#ffe6cc` | Key action steps |
| Yellow | `#fff4cc` | Decision diamonds |
| Green | `#ccffcc` | Success/completion |
| Red | `#ffcccc` | Blocked/error states |
| Gray | `#f5f5f5` | Standard nodes (default) |

**Node conventions:**
- `shape=box` with `style="rounded,filled"` for actions
- `shape=diamond` for decision points
- `shape=ellipse` for continuation/terminal nodes
- `[style=dashed]` on edges for fallback/retry paths

## Core Philosophy (Preserve These)

- **Confidence gates:** <70% research, 70-85% ship+monitor, ≥85% ship
- **Quality footer:** Confidence, Alternative, Reversible, Key Assumption, Complexity
- **Session types:** Build/Debug/Plan/Reflect with engagement levels (Autonomous/Collaborative/Guided)
- **Stateless:** No persistent state files. Conversation history is source of truth.
- **Execution model:** Human-driven exploration → machine-verified execution

## Compact Instructions

When compacting conversation history, always preserve:
- The `[SESSION] Type: X | Engagement: Y` marker
- Active criteria and mustNot constraints from shape
- Current loop progress (wave number, items completed)

## Anti-Patterns

- Generic names (`*Manager`, `*Helper`, `*Utils`)
- Reference chains or deep `references/` hierarchies
- Time estimates instead of story points
- Duplicating content across docs (link to single source)
- Windows paths or magic numbers in scripts
- **Process details in skill descriptions** (causes Claude to skip flowcharts)
- Inline examples longer than 5 lines
- Navigation/catalog sections in skills (tool indexes, skill tables)
- Skills over 200 lines
- Persistent state files (.jsonl, workflow-state.json)
- Task management APIs in skills (TaskCreate/TaskList/TaskUpdate)

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
