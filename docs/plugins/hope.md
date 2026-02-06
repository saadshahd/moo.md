# hope

Think before building.

---

## What changes

Before hope:
> "This should work" → guess → debug → rebuild

After hope:
> Clarify intent → search solutions → list risks → build once

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
| `hope:soul` | Core thinking framework (auto-applied) |
| `hope:intent` | Clarify vague requests into iron-clad specs |
| `hope:shape` | Bridge WHAT to HOW — select collaboration shape |
| `hope:verify` | Machine-verifiable acceptance criteria |
| `hope:gate` | Verification before claiming done |
| `hope:breakthrough` | Creative unblocking when stuck |
| `hope:trace` | Root cause analysis |
| `hope:interactive-code-review` | PR walkthrough |
| `hope:presence` | Focus and attention tracking |
| `hope:skill-judge` | Quality audit for skills |

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
