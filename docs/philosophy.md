# moo.md Philosophy

Principles for building and maintaining moo.md plugins.

---

## Core Belief

Under pressure, humans forget to think clearly.

moo.md plugins encode disciplines that matter most when stress is highest:
- Pause before building
- Name what you don't know
- Search for prior art
- Surface what could fail
- Ship with honesty

When you forget, Claude remembers.

---

## Architecture

### hope is the Core

`hope` is the cognitive foundation. All other plugins are domain satellites.

```
          hope
           │
    ┌──────┼──────┐
    │      │      │
product  wordsmith founder
    │
  career
```

**Domain plugins should:**
- Recommend installing hope (not enforce)
- Work standalone but lack rigor without hope
- Inherit hope's principles when hope is present

### What hope Provides

| Concept | Description |
|---------|-------------|
| Confidence gates | <70% research, 70-85% ship+monitor, ≥85% ship |
| Quality footer | Confidence, Alternative, Reversible, Complexity |
| Workflows | A=Build, B=Debug, C=Refactor |
| Intent clarification | ≥85% confidence before building |
| Learnings | Persist insights across sessions |

Domain plugins add domain-specific workflows; hope adds thinking rigor.

---

## Target User

Knowledge workers who:
- Use Claude Code (or compatible tools)
- Want structured thinking, not just autocomplete
- Value clarity over speed
- Work across domains (code, product, writing, strategy)

Not just developers. Anyone who thinks for a living.

---

## What Makes a moo.md Plugin

### Required

| Element | Description |
|---------|-------------|
| Single domain | Clear, non-overlapping scope |
| Router skill | Main SKILL.md routes to reference workflows |
| Ask-first | Gather input before proceeding |
| Artifacts | Produce usable outputs (not advice) |

### Recommended

| Element | Description |
|---------|-------------|
| Confidence gates | Adopt hope's gates when decisions matter |
| Quality footer | End non-trivial outputs with the footer |
| Story points | Complexity, never time estimates |

### File Structure

```
<plugin>/
├── .claude-plugin/
│   └── plugin.json          # name, version, description, keywords, author
├── skills/
│   └── <skill-name>/
│       ├── SKILL.md         # Router + core logic (<500 lines)
│       └── references/      # Split workflows (one level deep)
└── commands/
    └── <verb>.md            # Thin wrappers
```

---

## Quality Checklist

Before a plugin ships:

- [ ] Has single, clear domain
- [ ] Router pattern with workflow table
- [ ] Ask-first in all workflows
- [ ] Produces artifacts, not just advice
- [ ] Version in plugin.json matches SKILL.md
- [ ] Documentation in docs/
- [ ] Listed in marketplace.json
- [ ] No vague terms ("probably", "maybe") - use percentages
- [ ] Story points, not time estimates

---

## What moo.md Does NOT Do

- **No enforcement** — Plugins recommend patterns; they don't block users
- **No overlap** — Each plugin owns its domain; avoid duplicating workflows
- **No abstraction for its own sake** — Every concept earns its place through use
- **No time estimates** — Story points only; velocity varies

---

## Versioning

Use semantic versioning: `MAJOR.MINOR.PATCH`

- **PATCH** — Bug fixes, typos, clarifications
- **MINOR** — New commands, new workflows, non-breaking changes
- **MAJOR** — Breaking changes to existing workflows

Version must match between:
- `plugin.json` → `version`
- `SKILL.md` → frontmatter `version`

---

## Categories

| Category | Plugin | Description |
|----------|--------|-------------|
| core | hope | Cognitive foundation |
| domain | product | PRDs, metrics, research |
| domain | wordsmith | Editing, voice, narrative |
| domain | founder | Validation, pitch, financials |
| domain | career | Interview prep, skill gaps |

Two categories: **core** (hope) and **domain** (everything else). This reflects hope's role as foundation.

---

## Contributing Plugins

To add a plugin to moo.md:

1. Follow file structure above
2. Pass quality checklist
3. Submit PR with:
   - Plugin directory
   - marketplace.json entry
   - docs/ page

Plugins must have single maintainer or explicit ownership.

---

## Why This Matters

The goal isn't to make Claude smarter. It's to make *you* more consistent.

Structured thinking is a discipline. Disciplines fail under pressure unless externalized.

moo.md externalizes the disciplines that matter most.
