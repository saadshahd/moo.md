---
name: consult
description: Use when asking "what would [expert] say", "best practice", "panel", "debate", or needing domain guidance. Triggers on expert names, style requests, tradeoff questions, or "stuck on".
---

Simulate expert perspectives by reasoning from documented positions to the user's context. Productive disagreement over comfortable consensus.

## Principles

- Ground every claim in documented work. Name the source and where coverage stops.
- If selected experts all agree easily, the wrong experts were selected.
- Land on one actionable recommendation. Debate without a next step is noise.
- Organize output by concern, not by expert.

## Modes

| Signal | Mode |
|--------|------|
| Named expert, keyword match | Single — one expert's perspective |
| "Panel", "debate", tradeoffs | Panel — 2-4 experts argue, then synthesize |
| "Review", "check against spec" | Review — 3-4 experts for breadth |
| "Stuck on", repeated failure | Unblock — 2-3 diagnostic experts |

## How

1. **Load profiles** — Match from `profiles/` using domain map below. Check blocklist (`~/.claude/counsel-blocklist.json`). Max 2 from same domain row for panels.

2. **Reason** — Each expert argues from documented positions. Surface what they'd push back on. Find the tensions.

3. **Synthesize** — Consensus + dissent + one concrete next step the user can act on today.

## Domain Map

74 profiles in `profiles/`. Route by domain:

| Domain | Profiles |
|--------|----------|
| React / Frontend / TS / JS | abramov, osmani, perry, wathan, vergnaud, simpson |
| Go / Systems | pike |
| Distributed Systems | lamport, kleppmann |
| Python | hettinger |
| Performance | gregg, osmani |
| Architecture / TDD / DDD | fowler, martin, alexander, feathers, beck, freeman, evans, newman, vernon |
| DevOps / Observability | hightower, majors, humble |
| REST / APIs | fielding |
| Product / Design / Leadership | cagan, jobs, norman, frost, zhuo |
| Startups | graham |
| Accessibility | soueidan |
| FP / Simplicity | hickey, milewski |
| State Machines | khorshid |
| AI / LLMs | willison |
| Tools for Thought | matuschak, appleton, victor, case, papert, kay, inkandswitch, brander, litt, kleppmann |
| Psychology | kahneman, klein, fogg, norman |
| Systems Thinking | meadows, deming, snowden |
| Strategy | boyd, goldratt, rumelt |
| Communication | tufte, orwell, minto |
| Anthropology | geertz, jacobs, scott |
| Economics | goodhart, ostrom, simon |
| Philosophy | popper, kuhn, wittgenstein |
| Sociology | perrow, vaughan, reason |
| Biology | kauffman, dawkins |
| Education | vygotsky, bruner |
| Security | schneier, shostack |

## Boundaries

Consult advises — it does not execute or decide. It returns results to the calling phase.
