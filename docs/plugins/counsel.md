# counsel

Expert simulation for code guidance, style, and debates.

---

| Say this                       | Get this                   |
| ------------------------------ | -------------------------- |
| "code like Addy Osmani"        | Style-matched code         |
| "what would Rich Hickey say"   | Expert perspective         |
| "/counsel:panel 'question'"    | Multi-expert debate        |
| "review this idiomatically"    | Auto-detected expert guidance |

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
- "panel", "review", "audit", "debate", "tradeoffs"
- Domain keywords from curated profiles

## Skills

| Skill | Purpose |
|-------|---------|
| `counsel:counsel` | Single-expert guidance, style matching |
| `counsel:panel` | Multi-expert debate for complex decisions |

## Core Concepts

**Confidence:** Curated profiles start at 6/10, dynamic simulation at 4/10. Ceiling is 9/10 (never claim perfect simulation). Floor is 3/10 (below this, refuse).

**42 curated profiles** across: React/Frontend, TypeScript/JS, Go/Systems, Python, Architecture, TDD, DDD, DevOps, Product, FP, Tools for Thought, Local-first.

---

> Source: [`counsel/skills/counsel/SKILL.md`](../../counsel/skills/counsel/SKILL.md)
