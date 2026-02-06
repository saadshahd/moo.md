# hope

Think before building.

---

## What changes

Before hope:
> "This should work" → guess → debug → rebuild

After hope:
> Clarify intent → shape approach → execute with verification → consult experts

Every response runs through a silent checklist:
- Intent clear?
- Libraries searched?
- Failure modes listed?
- Verification stated?

You don't see the checklist. You see better answers.

---

## Quick start

```bash
/plugin install hope@moo.md
```

Try:
```
plan building a REST API for user management
```

Or:
```
shape the implementation approach for a settings page
```

---

## Skills

| Skill | Purpose |
|-------|---------|
| `hope:soul` | Session strategy + thinking framework (auto-applied) |
| `hope:intent` | Clarify vague requests into iron-clad specs |
| `hope:shape` | Bridge WHAT to HOW — select collaboration shape |
| `hope:loop` | Autonomous iteration with wave-based execution |
| `hope:consult` | Expert simulation — 42 curated profiles, panels, unblocking |

---

## Session Strategy

Soul auto-detects session type from your first message:

| Type | When | Pipeline |
|------|------|----------|
| **Build** | "build", "implement", "create" | intent → shape → loop |
| **Debug** | "fix", "bug", "error" | intent → shape → loop |
| **Plan** | "plan", "design", "explore" | intent → shape → output |
| **Reflect** | "postmortem", "review" | intent → consult → output |

Then asks engagement level once:
- **Autonomous** — experts clarify and execute
- **Collaborative** — co-drive with expert assist (default)
- **Guided** — you make all decisions

---

## Verification gates

Dual-signal system: verification type (primary) + subjective estimate (secondary).

| Verification Type | Sufficient for SHIP? |
|-------------------|---------------------|
| `execution output` | Yes |
| `observation` | Yes |
| `measurement` | Yes |
| `code review` | Weak |
| `assumption` | Blocks SHIP |

Subjective percentages are Claude's estimates, not calibrated accuracy. Weight verification type higher.

---

> Source: [`hope/skills/soul/SKILL.md`](../../hope/skills/soul/SKILL.md)
