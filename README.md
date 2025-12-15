# moo.md

Claude Code plugins that make Claude state its confidence, list failures, and think before acting.

## What Changes

| Before moo.md                | After moo.md                           |
| ---------------------------- | -------------------------------------- |
| "This should work"           | "85% confident because [evidence]"     |
| Builds first, searches later | Searches libraries before writing code |
| Hopes nothing breaks         | Lists failure modes before starting    |
| Forgets what worked          | Recalls insights from past sessions    |

## See It In Action

Every response ends with a verdict box:

```
🟢 SHIP
╭────────────────────────────────╮
│ 85% confident · Type 2A · 3pt  │
├────────────────────────────────┤
│ Alt: Manual approach (80%)     │
│ Risk: Rate limits              │
╰────────────────────────────────╯
```

- **🟢 SHIP** (≥85%): Act now
- **🟡 MONITOR** (70-85%): Act with monitoring
- **🔴 RESEARCH** (<70%): Research first

## What Runs Quietly

Before responding, Claude checks:

- Intent clear?
- Libraries searched?
- Failure modes listed?
- Confidence stated?
- Reversibility assessed?

30+ thinking tools run automatically: Inversion, Pre-Mortem, Ishikawa, Five Whys, Decision Matrix.

## Install

```bash
/plugin marketplace add saadshahd/moo.md
/plugin install hope@moo.md
```

## Plugins

| Plugin                                 | What It Does                                                     |
| -------------------------------------- | ---------------------------------------------------------------- |
| [hope](docs/plugins/hope.md)           | Core thinking system — confidence gates, silent audit, workflows |
| [product](docs/plugins/product.md)     | PRDs, competitive analysis, metrics                              |
| [wordsmith](docs/plugins/wordsmith.md) | Editing, voice extraction, narrative                             |
| [founder](docs/plugins/founder.md)     | Idea validation, pitch decks, financials                         |
| [career](docs/plugins/career.md)       | Interview prep, skill gaps, stakeholder navigation               |

## Documentation

- [5-Minute Start](docs/getting-started.md) — Install and see value immediately
- [Learnings System](docs/learnings-system.md) — Insights persist across sessions

## Issues

Something broken? Onboarding unclear? Feature request?

→ [Open an issue](https://github.com/saadshahd/moo.md/issues)

## Gratitude

**[Nate B. Jones](https://www.natebjones.com/)** — grounded thinking, advanced prompting

**[Superpowers](https://github.com/obra/superpowers)** — prior art
