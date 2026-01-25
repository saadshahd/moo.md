# design — Power User Reference

Design exploration workflows for Claude Code.

---

| Say this                        | Get this                         |
| ------------------------------ | -------------------------------- |
| "map the user journey for X"   | Journey map with stages + risks  |
| "define the IA for X"          | IA options + navigation models   |
| "explore visual directions"    | 3 distinct design directions     |
| "compare competitor UX flows"  | Flow teardown + pattern gaps     |
| "critique this design feedback" | Structured critique guidance     |

---

## Install

```bash
/plugin install design@moo.md
```

## When It Activates

Auto-triggers on:

- Visual directions, UI/UX exploration, and design systems
- Journey mapping or experience flows
- Information architecture and navigation
- Competitor UX comparisons
- Design critiques and feedback

## Workflows (Skill-Driven)

These are skill workflows triggered by natural language prompts, not slash commands.

| Workflow          | Purpose                                         |
| ---------------- | ----------------------------------------------- |
| Constraints      | Surface limits before exploration               |
| Journey          | Map user journey stages and touchpoints         |
| IA               | Propose IA structures and navigation options    |
| Directions       | Generate 3 distinct visual directions           |
| System           | Translate direction into system principles      |
| Compare          | Competitive UX flow analysis                    |
| Critique         | Structured design feedback and improvements     |

## Available Slash Commands

| Command               | Purpose                                      |
| -------------------- | -------------------------------------------- |
| `/design:figma-prompt` | Generate Figma AI prompt text               |
| `/design:tokens`       | Produce DTCG design tokens                  |
| `/design:wireframe`    | Produce WireMD wireframe mockups            |

## Workflow Flow

```
constraints → journey → ia → directions → system
                                 ↓
                               copy

compare → (anytime for research)
critique → (anytime for feedback)
```

## Core Principles

- Exploration first, commitment later
- Always produce 3+ options
- No visual execution (no code, no Figma)
- WCAG considerations in every visual workflow

---

→ Source: [`design/skills/design/SKILL.md`](../../design/skills/design/SKILL.md)
