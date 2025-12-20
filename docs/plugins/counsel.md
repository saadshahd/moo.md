# counsel — Power User Reference

Expert simulation for code guidance and style.

---

| Say this                       | Get this                   |
| ------------------------------ | -------------------------- |
| "code like Addy Osmani"        | Style-matched code         |
| "what would Rich Hickey say"   | Expert perspective         |
| "/counsel:panel 'question'"    | Multi-expert debate        |
| "review this idiomatically"    | Auto-detected expert guidance |
| "/counsel:calibrate 'fix'"     | Correct simulation errors  |

---

## Install

```bash
/plugin install counsel@moo.md
```

## When It Activates

Auto-triggers on:

- "code like [expert]", "write like [expert]"
- "what would [expert] say", "ask [expert]"
- "idiomatic", "best practice", "clean code"
- "panel", "review", "audit"
- Domain keywords from curated profiles

## Commands

| Command               | Purpose                                                           |
| --------------------- | ----------------------------------------------------------------- |
| `/counsel:summon`     | Invoke single expert. Usage: `/counsel:summon addy osmani`        |
| `/counsel:panel`      | Multi-expert debate. Usage: `/counsel:panel "Redux vs Zustand?"`  |
| `/counsel:calibrate`  | Correct simulation errors. Stored for future sessions.            |

## Core Concepts

**Confidence:** Curated profiles start at 6/10, dynamic simulation at 4/10. Ceiling is 9/10 (never claim perfect simulation). Floor is 3/10 (below this, refuse).

**Calibration:** Corrections stored in `.claude/logs/counsel-calibrations.jsonl`. Applied automatically in future sessions.

**Expert Catalog:** See [inference.md](../../counsel/skills/counsel/references/inference.md) for full list of 20 curated experts.

---

→ Source: [`counsel/skills/counsel/SKILL.md`](../../counsel/skills/counsel/SKILL.md)
