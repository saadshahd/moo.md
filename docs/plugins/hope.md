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
delve into how authentication works in this repo
```

Or:
```
plan building a REST API for user management
```

---

## Trigger keywords

| Say this | Get this |
|----------|----------|
| "delve into how X works" | Deep code investigation |
| "plan building X" | Intent clarification + structured plan |
| "recall what I learned about X" | Surface past learnings |

---

## Commands

| Command | Purpose |
|---------|---------|
| `/hope:plan` | Clarify intent, search libraries, list risks |
| `/hope:debug` | Effect → Cause → Root → Fix → Prevent |
| `/hope:postmortem` | Structured post-incident review |
| `/hope:learn` | Extract insights to `~/.claude/learnings/` |
| `/hope:recall` | Surface relevant learnings for context |
| `/hope:mirror` | Detect blind spots in a decision |
| `/hope:reframe` | Alternative framings for stuck problems |

---

## Verification gates

Dual-signal system: verification type (primary) + subjective estimate (secondary).

| Verification Type | Sufficient for SHIP? |
|-------------------|---------------------|
| `execution output` | ✓ Yes |
| `observation` | ✓ Yes |
| `measurement` | ✓ Yes |
| `code review` | ⚠️ Weak |
| `assumption` | ✗ Blocks SHIP |

Subjective percentages are Claude's estimates, not calibrated accuracy. Weight verification type higher.

---

## Deep reference

- [Thinking tools](../../hope/skills/soul/SKILL.md#all-tools-when-default-doesnt-fit) — 34 mental models
- [Quality footer](../../hope/skills/soul/references/quality-footer.md) — Verdict format
- [Learnings system](../learnings-system.md) — How insights persist

→ Source: [`hope/skills/soul/SKILL.md`](../../hope/skills/soul/SKILL.md)
