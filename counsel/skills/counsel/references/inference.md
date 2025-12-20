# Dynamic Expert Inference

Logic for detecting which expert to simulate when not explicitly specified.

---

## Detection Order

1. **Explicit mention** — Expert name in query → direct match
2. **Trigger keywords** — Match against curated profile keywords
3. **File context** — Infer from file extensions / imports
4. **Domain signals** — Topic-based routing
5. **No match** — Ask user to specify or proceed with generic guidance

---

## File Context Inference

When code files are in context:

| Signal | Inferred Domain | Default Expert |
|--------|-----------------|----------------|
| `.tsx`, `.jsx`, React imports | React/Frontend | Osmani or Abramov |
| React hooks, useEffect, useState | React internals | Abramov |
| `tailwind.config`, `@apply` | CSS/Tailwind | Wathan |
| `.clj`, `.edn`, Clojure | Functional/Data | Hickey |
| Complex JS, scope issues | JS Deep Dive | Simpson |
| `.go`, Go imports | Go/Backend | Pike |
| `.py`, Python imports | Python | Hettinger |
| `framer-motion`, motion imports | Animations | Perry |
| XState, state machine imports | State Machines | Khorshid |
| Kubernetes, k8s, Docker | DevOps/Infrastructure | Hightower |
| ARIA, a11y, accessibility | Accessibility | Soueidan |
| Category theory, functors, monads | FP Theory | Milewski |
| LLM, GPT, Claude, AI imports | LLMs/AI | Willison |

---

## Domain Signal Inference

When discussing topics without code context:

| Topic Keywords | Inferred Expert |
|----------------|-----------------|
| Refactoring, patterns, architecture, microservices | Fowler |
| Startup, founder, Y Combinator, growth | Graham |
| Product discovery, roadmap, empowered teams | Cagan |
| Design systems, atomic design, pattern library | Frost |
| Product design, design team, design leadership | Zhuo |
| UX, usability, affordances, mental models | Norman |
| Observability, on-call, incident, production debugging | Majors |

---

## No Match Behavior

When no expert can be inferred, offer options: specify expert name, share code files for context, or proceed without expert simulation.

---

## Dynamic Simulation Warning

For experts without curated profiles:

```
**Channeling [Expert Name]** (4/10 confidence — no curated profile)

⚠️ LOW CONFIDENCE: This simulation is based on general knowledge about [Expert].
For higher-quality simulation, consider adding a curated profile.

[Response attempt]
```

---

## Multi-Expert Detection

When query involves multiple domains:

1. Identify up to 3 relevant experts
2. Check if panel is appropriate (design decision, tradeoff, review)
3. If yes → route to panel workflow
4. If no → use primary expert, note others as "also relevant"

Example:
> "Should I use Zustand or Redux for state management?"

Detected: Hickey (data philosophy), Osmani (React patterns), Simpson (JS mechanics)
→ Route to panel with all three.
