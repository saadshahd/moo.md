# CLAUDE.md

## What This Is

moo — mind on output. Stay present with AI.

## Structure

```
moo.md/
├── hope/                    # Cognitive operating system
├── product/                 # PRDs, competitive analysis, metrics
├── wordsmith/               # Editing, voice, narrative
├── founder/                 # Startup validation, financials
├── career/                  # Interview prep, skill gaps
├── prompts/                 # Standalone prompt library
├── docs/                    # User docs: plugins/, dev/ (internal)
├── eval/                    # Skill evaluation tests
└── .github/hooks/           # Git hooks (pre-push runs evals)
```

Each plugin follows:

```
<plugin>/
├── .claude-plugin/plugin.json    # name, version, description, keywords, author
├── skills/<name>/SKILL.md
└── skills/<name>/references/
```

Plugin discovery uses `.claude-plugin/marketplace.json` at repo root (lists all plugins).

## Local Testing

```bash
# From parent directory:
/plugin marketplace add ./moo.md
/plugin install hope@moo.md
```

## Evaluations

Run `bun run eval/run.ts [plugin]` to test skill triggering. Pre-push hook runs evals automatically for changed plugins.

**When adding skills:** Add test case YAML to `<plugin>/eval/cases/`.

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

**⚠️ DESCRIPTION TRAP WARNING:** Skill descriptions must be **trigger-only**. If descriptions contain process summaries or workflow steps, Claude follows the short description instead of reading the detailed flowchart/instructions. Keep descriptions focused on "Use when X" patterns only.

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

### Reference Files

- Place in `skills/<skill-name>/references/`
- Subdirectories allowed for organization (e.g., `references/tools/`, `references/profiles/`)
- No reference chains: a reference file should not require loading another reference to function
- Exception: intra-plugin sharing allowed (e.g., `trace` referencing `soul/references/blameless.md`)
- Keep SKILL.md under 500 lines; split to references if larger

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
- **Workflows:** A=Build, B=Debug, C=Refactor
- **Learnings:** `~/.claude/learnings/*.jsonl`

## State File Schemas

JSON state files have formal schemas in `schemas/`:

| File Pattern | Schema | Used By |
|--------------|--------|---------|
| `.loop/workflow-state.json` | `workflow-state.schema.json` | loop plugin |
| `~/.claude/learnings/*.jsonl` | `learnings.schema.json` | hope/learn, hope/recall |

**When modifying state files:**
1. Check schema in `schemas/` before adding fields
2. New fields must be optional (backward compatible)
3. Breaking changes require `version` bump + migration in consuming hooks
4. Update all skills/hooks that read the state file

**When creating skills that use state:**
- Define schema in `schemas/` if new file type
- Document schema in skill's references/
- Validate required fields before processing
- Fail gracefully on schema mismatch

**Schema evolution:**
- Version field tracks breaking changes
- Hooks handle migration for old versions
- Document changes in CHANGELOG.md

## Anti-Patterns

- Generic names (`*Manager`, `*Helper`, `*Utils`)
- Nested reference chains (A → B → C)
- Time estimates instead of story points
- Duplicating content across docs (link to single source)
- Windows paths or magic numbers in scripts
- **Process details in skill descriptions** (causes Claude to skip flowcharts)

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
