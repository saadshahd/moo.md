# loop

Autonomous iteration with subagent waves.

---

| Say this                 | Get this                                |
| ----------------------- | ---------------------------------------- |
| "loop until done"       | Autonomous iteration until spec complete |
| "keep going"            | Continue work with parallel subagents    |
| "fix all problems"      | Multi-step loop with counsel auto-unblock |
| "continue until tests pass" | Iterate until success or limits hit   |

---

## Install

```bash
/plugin install loop@moo.md
```

## How It Works

1. **Spec scoring** — Scores clarity (0-10) before starting
2. **Shape** — Chooses Tool / Tool-Review / Colleague workflow
3. **Decompose** — Breaks spec into atomic work items
4. **Wave execution** — Invokes parallel subagents per wave
5. **Auto-unblock** — counsel:panel reviews when stuck
6. **Completion** — hope:verify + hope:gate before claiming done

## Skills

| Skill | Purpose |
|-------|---------|
| `loop:start` | Start or resume autonomous loop |
| `loop:status` | Show current progress |
| `loop:cancel` | Gracefully terminate loop |

---

> Source: [`loop/skills/start/SKILL.md`](../../loop/skills/start/SKILL.md)
