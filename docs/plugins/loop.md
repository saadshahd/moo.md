# loop — Power User Reference

Autonomous iteration for Claude Code.

---

| Say this                 | Get this                                |
| ----------------------- | ---------------------------------------- |
| "loop until done"       | Persistent iteration until spec complete |
| "keep going"            | Continue work across iterations          |
| "fix all problems"      | Multi-step loop with stop hooks          |
| "continue until tests pass" | Iterate until success or limits hit   |

---

## Install

```bash
/plugin install loop@moo.md
```

## When It Activates

Auto-triggers on:

- "loop", "keep going", "don't stop"
- "continue until done", "until tests pass"
- "implement full feature", "fix all problems"

## Workflows (Skill-Driven)

Loop runs as a skill workflow triggered by natural language, not slash commands.

Example triggers:
```
loop until done
keep going
continue until tests pass
implement full feature
```

## How It Works

- Scores spec clarity before starting
- Chooses tool-shaped or colleague-shaped workflow
- Uses stop hooks to decide when to pause or finish

---

→ Source: [`loop/skills/start/SKILL.md`](../../loop/skills/start/SKILL.md)
