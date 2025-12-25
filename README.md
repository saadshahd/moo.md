<p align="center">
  <img src="docs/assets/poster.png" alt="mind on output — stay present with AI" width="600">
  <br/>
  Plugins that make Claude state confidence, list failures, and present structured reasoning before acting.
</p>

<br/>

| Before                       | After                                  |
| ---------------------------- | -------------------------------------- |
| "This should work"           | "85% confident because [evidence]"     |
| Builds first, searches later | Searches libraries before writing code |
| Hopes nothing breaks         | Lists failure modes before starting    |
| Forgets what worked          | Recalls insights from past sessions    |

## See It In Action

<table>
  <tr>
    <td align="center" valign="top" width="50%">
      <p><sub>Planning phase</sub></p>
      <img src="docs/assets/plan.png" alt="moo planning phase" style="max-width: 100%;">
    </td>
    <td align="center" valign="top" width="50%">
      <p><sub>Verdict box</sub></p>
      <img src="docs/assets/verdict.png" alt="moo verdict box" style="max-width: 100%;;">
    </td>
  </tr>
  <tr>
    <td align="center" valign="top" width="50%">
      <p><sub>Root Cause Analysis</sub></p>
      <img src="docs/assets/ishikawa.png" alt="Ishikawa diagram" style="max-width: 100%;;"><br>
    </td>
    <td align="center" valign="top" width="50%">
      <p><sub>Five Whys</sub></p>
      <img src="docs/assets/five-whys.png" alt="Five Whys"  style="max-width: 100%;;"><br>
    </td>
  </tr>
  <tr>
    <td align="center" valign="top">
      <p><sub>Decision Matrix</sub></p>
      <img src="docs/assets/decision.png" alt="Decision matrix" style="max-width: 100%;;"><br>
    </td>
    <td align="center" valign="top">
      <p><sub>Impact-Effort</sub></p>
      <img src="docs/assets/impact.png" alt="Impact-effort matrix" style="max-width: 100%;;"><br>
    </td>
  </tr>
  <tr>
    <td align="center" valign="top">
      <p><sub>Minto Pyramid</sub></p>
      <img src="docs/assets/minto.png" alt="Minto pyramid" style="max-width: 100%;;"><br>
    </td>
    <td align="center" valign="top">
      <p><sub>Pre-Mortem</sub></p>
      <img src="docs/assets/premortem.png" alt="Pre-mortem" style="max-width: 100%;;"><br>
    </td>
    
  </tr>
</table>

## What Runs Quietly

Before responding, Claude checks:

- Intent clear?
- Libraries searched?
- Failure modes listed?
- Confidence stated?
- Reversibility assessed?

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
| [counsel](docs/plugins/counsel.md)     | Expert simulation for code guidance and style                    |

## Documentation

- [5-Minute Start](docs/getting-started.md) — Install and see value immediately
- [Learnings System](docs/learnings-system.md) — Insights persist across sessions

## Issues

Something broken? Onboarding unclear? Feature request?

→ [Open an issue](https://github.com/saadshahd/moo.md/issues)

## Gratitude

**[Nate B. Jones](https://www.natebjones.com/)** — grounded thinking, advanced prompting

**[Superpowers](https://github.com/obra/superpowers)** — prior art

**[Farnam Street](https://fs.blog/blog/)** - For the excellent writings
