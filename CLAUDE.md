# CLAUDE.md

## What This Is

moo — mind on output. Stay present with AI.

## Structure

```
moo.md/
├── hope/                    # Single plugin: 8 skills, 9 commands, hooks
│   ├── skills/
│   │   ├── soul/            # Session strategy + thinking framework
│   │   ├── intent/          # Clarify WHAT
│   │   ├── shape/           # Decide HOW (consult-driven)
│   │   ├── loop/            # Execute + verify + complete
│   │   ├── consult/         # Expert simulation (74 profiles)
│   │   ├── bond/            # Team composition (agent teams)
│   │   ├── forge/           # Persistent agent creation
│   │   └── search/          # Code search (sg/rg) reference
│   ├── commands/            # panel, summon, block, unblock, blocked, intent, bond, forge, full
│   ├── hooks/               # SessionStart + SubagentStart + PreToolUse + PreCompact
│   └── scripts/             # Per-turn session strategy injector
├── docs/                    # User docs
└── .github/hooks/           # Git hooks (pre-push validates skills)
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
intent (clarify WHAT) → shape (decide HOW) → bond (compose WHO) → loop (execute + verify) → consult (expert guidance)
                                               forge (create AGENT) ─┘
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

## Hooks Architecture

Hooks use `async: true` only when intentional — async output arrives on the **next** turn, not the current one.

| Hook | Sync/Async | Why |
|------|-----------|-----|
| SessionStart | **Sync** | Soul content must be available on turn 1 |
| SubagentStart | **Sync** (command) | Subagents need criteria before executing |
| PreToolUse:Bash | **Sync** | Denies `grep` — enforces rg/sg usage |
| PreToolUse:ExitPlanMode | **Sync** | Sequential deny chain: pipeline artifacts → coverage verification, max 3 denials |
| PreCompact | **Sync** (prompt) | Must extract state before compaction runs |

**Project-level hooks** (in `.claude/settings.json`, not shipped with plugin):

| Hook | Why |
|------|-----|
| SessionStart | Surfaces pending roadmap item count |
| PreToolUse:Write | Blocks writes to `references/` directories |
| PostToolUse:Write/Edit | Warns when SKILL.md exceeds 200 lines |
| PostToolUse:Write/Edit | Validates ROADMAP.md line count and line length |
| Stop (prompt) | Nudges roadmap updates at session end |

**Key learnings:**
- `additionalContext` appears as `<system-reminder>` tags — visible to Claude, silent to user
- Hook context is appended after user message (no prepend mechanism exists)
- Action directives ("invoke X now") outperform evaluation checklists ("before responding, evaluate...")
- Plugin hooks may silently discard output for marketplace installs (#12151, #16538) — `--plugin-dir` works reliably
- Hooks are snapshotted at startup; restart to pick up changes

## Conventions

### Frontmatter (Required)

**Skills:**

```yaml
---
name: kebab-case-name
description: Single line. WHAT (purpose) + WHEN (triggers). Max 1024 chars.
---
```

> **Note:** Version lives in `plugin.json` only (DRY). The official Claude Code spec does not allow `version` in SKILL.md frontmatter.

**DESCRIPTION PATTERN:** Descriptions must contain **WHAT** (purpose statement) + **WHEN** (trigger conditions). Lead with purpose, follow with triggers. A purpose statement ("Session strategy for X") is a trigger. A process summary ("First detect type, then set engagement, then emit marker") is the trap. Never summarize workflow steps in descriptions — Claude follows the short description instead of reading the detailed SKILL.md instructions.

**Commands:**

```yaml
---
description: Single line. WHAT + WHEN. Max 1024 chars.
argument-hint: what to type after the command name
---
```

`argument-hint` appears in autocomplete when users type `/hope:`. It tells them what argument to provide. Omit for commands that take no arguments.

**Agents:**

```yaml
---
description: Single line. WHAT + WHEN.
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

moo drives toward three outcomes: **reduce decision regret**, **increase conceptual clarity**, **leave fewer but stronger artifacts**. Every belief and principle below serves at least one.

1. **Thinking = prevention** — Better thinking prevents mistakes. They're inseparable. Don't add safety nets separate from the thinking process.
2. **Encode what humans forget** — If it matters under pressure, encode it in skills/hooks. Not docs. Not willpower.
3. **Perspectives prevent blindness** — Solo thinking has systematic blind spots. Seek multiple expert lenses.
4. **Adapt to context** — Never force one workflow. Respect session type and engagement level.
5. **Primer over tool** — moo instills thinking habits, not just processes. Context AND behavior persist.
6. **Loose coupling** — Natural language triggers between skills. No hard imports. If a skill isn't installed, nothing breaks.
7. **Boundaries over aspirations** — Define forbidden states before ideal states. Negative constraints survive ambiguity.
8. **Co-located constraints** — Embed rules in the artifact that crosses the boundary. Separate context vanishes.

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
- [ ] Does this serve at least one aim (regret reduction / conceptual clarity / fewer artifacts)? → Every mechanism must trace to an outcome
- [ ] Does this assert verifiable facts from memory? → Retrieved over recalled

### Statechart (Canonical Reference)

See `docs/statechart.md` for the full hierarchical state machine. This is the single source of truth for plugin flow. When adding or modifying skills, verify alignment with the statechart. When the statechart changes, update affected skills.

See `PHILOSOPHY.md` for full beliefs, principles (stance + why), and constraints.

## Compact Instructions

When compacting conversation history, always preserve:
- The `[SESSION] Type: X | Engagement: Y | Horizon: Z | Feasible: W` marker
- Active criteria, mustNot constraints, horizon, and feasibility axis + bound from shape
- Current loop progress (wave number, items completed)
- Failed approaches and what they ruled out

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
