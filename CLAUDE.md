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
# Dev mode — loads directly from source, restart to pick up changes:
claude --plugin-dir ./moo.md

# If hope is installed from marketplace, disable it first to avoid duplicates:
/plugin disable hope@moo.md

# Pre-release verification — tests the packaged user experience:
/plugin marketplace add ./moo.md
/plugin install hope@moo.md
```

See [docs/dev/local-development.md](docs/dev/local-development.md) for full workflow.

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

Use DOT for non-linear decision flows. Claude follows DOT structure more reliably than prose.

**When to use:** Multi-path decisions, loops, branching workflows.
**When NOT to use:** Linear steps (use numbered lists).
**Exception:** `docs/statechart.md` uses Mermaid `stateDiagram-v2` — better fit for hierarchical state machines with composite states, parallel regions, and choice pseudostates. Skills continue using DOT for inline decision flows.

**Keep structural only:**
- Node labels (the text)
- Edge connections (the arrows)
- Edge labels (conditions)
- `rankdir=TB` or `rankdir=LR` (flow direction)

**Strip visual attributes:** `fillcolor`, `style`, `shape` — LLMs can't render these.

## Philosophy (Enforce These)

Core beliefs — every change to this project must align:

1. **Thinking = prevention** — Better thinking prevents mistakes. They're inseparable. Don't add safety nets separate from the thinking process.
2. **Encode what humans forget** — If it matters under pressure, encode it in skills/hooks. Not docs. Not willpower.
3. **Perspectives prevent blindness** — Solo thinking has systematic blind spots. Seek multiple expert lenses.
4. **Adapt to context** — Never force one workflow. Respect session type and engagement level.
5. **Primer over tool** — moo instills thinking habits, not just processes. Context AND behavior persist.
6. **Loose coupling** — Natural language triggers between skills. No hard imports. If a skill isn't installed, nothing breaks.

### Philosophy Audit (Before Committing Changes)

- [ ] Does this add complexity without justification? → Simplicity wins conflicts
- [ ] Does this introduce persistent state? → Conversation is the only state
- [ ] Are exit criteria machine-verifiable? → No ambiguous "works correctly"
- [ ] Could an existing skill/framework handle this? → Proven over invented
- [ ] Does this encode something humans forget, or duplicate what they'd remember? → Automatic over remembered
- [ ] Was this investigated before implemented? → Never combine find + fix
- [ ] Does this hardcode references to specific skills? → Natural language triggers only
- [ ] Does this create coupling that breaks if a skill is missing? → Loose coupling required
- [ ] Does this build something Claude will do natively? → Don't compete with the platform

### Statechart (Canonical Reference)

See `docs/statechart.md` for the full hierarchical state machine. This is the single source of truth for plugin flow. When adding or modifying skills, verify alignment with the statechart. When the statechart changes, update affected skills.

See `PHILOSOPHY.md` for full beliefs, principles (stance + why), and constraints.

## Compact Instructions

When compacting conversation history, always preserve:
- The `[SESSION] Type: X | Engagement: Y | Feasible: Z` marker
- Active criteria, mustNot constraints, and feasibility axis + bound from shape
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
- Hardcoded `Skill(skill="specific:name")` cross-references in skills
- Building features Claude Code will ship natively (task management, memory, tool orchestration)
- Cargo cult process steps (ritual without reason)
- Skill behavior that contradicts `docs/statechart.md` (statechart is canonical)

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
