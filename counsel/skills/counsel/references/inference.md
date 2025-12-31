# Dynamic Expert Inference

Logic for detecting which expert to simulate when not explicitly specified.

---

## Curated Profiles

| Expert | Domain | Profile |
|--------|--------|---------|
| Dan Abramov | React/State | [abramov.md](profiles/abramov.md) |
| Marty Cagan | Product Discovery | [cagan.md](profiles/cagan.md) |
| Martin Fowler | Architecture/Patterns | [fowler.md](profiles/fowler.md) |
| Brad Frost | Design Systems | [frost.md](profiles/frost.md) |
| Paul Graham | Startups/Essays | [graham.md](profiles/graham.md) |
| Raymond Hettinger | Python | [hettinger.md](profiles/hettinger.md) |
| Rich Hickey | Data/Simplicity | [hickey.md](profiles/hickey.md) |
| Kelsey Hightower | DevOps/Kubernetes | [hightower.md](profiles/hightower.md) |
| David Khorshid | State Machines/XState | [khorshid.md](profiles/khorshid.md) |
| Charity Majors | Observability | [majors.md](profiles/majors.md) |
| Bartosz Milewski | Category Theory/FP | [milewski.md](profiles/milewski.md) |
| Don Norman | UX/Design Psychology | [norman.md](profiles/norman.md) |
| Addy Osmani | JS Performance/Patterns | [osmani.md](profiles/osmani.md) |
| Matt Perry | Animation/Framer Motion | [perry.md](profiles/perry.md) |
| Rob Pike | Go/Systems | [pike.md](profiles/pike.md) |
| Kyle Simpson | JS Deep Dive | [simpson.md](profiles/simpson.md) |
| Sara Soueidan | Accessibility/ARIA | [soueidan.md](profiles/soueidan.md) |
| Gabriel Vergnaud | TypeScript Type-Level | [vergnaud.md](profiles/vergnaud.md) |
| Adam Wathan | Tailwind/CSS | [wathan.md](profiles/wathan.md) |
| Simon Willison | LLMs/AI Tools | [willison.md](profiles/willison.md) |
| Julie Zhuo | Design Leadership | [zhuo.md](profiles/zhuo.md) |

---

## Detection Order

1. **Explicit mention** — Expert name in query → direct match
2. **Trigger keywords** — Match against curated profile keywords
3. **File context** — Infer from file extensions / imports
4. **Domain signals** — Topic-based routing
5. **No match** — Ask user to specify or proceed with generic guidance

**After detection:** Generate a descriptor based on why the expert is relevant to this question. Never use expert names in output. See the Confidence & Guardrails reference for descriptor generation rules.

---

## File Context Inference

When code files are in context:

| Signal | Inferred Domain | Default Expert |
|--------|-----------------|----------------|
| `.tsx`, `.jsx`, React imports | React/Frontend | Osmani or Abramov |
| React hooks, useEffect, useState | React internals | Abramov |
| `.ts`, `.d.ts`, complex generics | TypeScript Type-Level | Vergnaud |
| Conditional types, `infer`, mapped types | TypeScript Advanced | Vergnaud |
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
| Type-level, generics, conditional types, infer, mapped types | Vergnaud |
| TS-Pattern, pattern matching, discriminated unions, exhaustive | Vergnaud |
| Template literal types, recursive types, type inference | Vergnaud |

---

## No Match Behavior

When no expert can be inferred, offer options: specify expert name, share code files for context, or proceed without expert simulation.

---

## Dynamic Simulation Warning

For experts without curated profiles, generate a descriptor from general knowledge about their philosophy:

```
**Channeling [descriptor]** (4/10 confidence — no curated profile)

⚠️ LOW CONFIDENCE: This simulation is based on general knowledge.
For higher-quality simulation, consider adding a curated profile.

[Response attempt]
```

Example: User asks about DHH → descriptor: "a convention-over-configuration advocate"

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
→ Route to panel with descriptors: a simplicity advocate, a performance-focused engineer, a JS fundamentals advocate
