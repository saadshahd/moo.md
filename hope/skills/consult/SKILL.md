---
name: consult
description: Simulates expert panels, compares documented positions across thought leaders, and synthesizes anonymous recommendations grouped by concern. Invoke when facing design tradeoffs, architecture decisions, repeated failure modes, or domain questions where multiple perspectives would reduce decision regret. Triggers on: expert names, "panel", "debate", "what would [X] say", "stuck on", style requests.
---

Simulate expert perspectives by reasoning from documented positions to the user's context. Productive disagreement over comfortable consensus.

## Principles

- Ground every claim in documented work — this is internal discipline. The user sees suggestions, not citations.
- For living figures, prefer newer model knowledge over profile facts past the `Verified:` footer — profiles constrain voice, guardrails, and routing, not currency.
- If selected experts all agree easily, the wrong experts were selected.
- Land on one actionable recommendation. Debate without a next step is noise.
- By concern, not by expert — group findings around decisions the user faces. Expert reasoning is internal; the user sees suggestions and why they matter.

## Presentation

These rules govern how consult communicates across all modes.

- **Minto pyramid via AskUserQuestion** — Label = the suggestion (conclusion first). Description = why it matters (always visible). Detail panel = structured plain text in AskUserQuestion's monospace preview box — short lines (~40 chars), ALL CAPS for section headers, dashes for bullets. No markdown formatting (renders as literal text, not rich text).
- **Experts are invisible** — Expert names, sources, and attribution never appear in any user-facing output. Not in text, labels, descriptions, or detail panels. Never "Fowler says" or "Hickey argues." The user sees suggestions and why they matter.
- **Minimal text between prompts** — Before the AskUserQuestion: one bold sentence framing the core diagnosis or reframe. After the user answers: one bold sentence with the next step. Nothing else. Use markdown **bold** for the key insight. No paragraphs, no per-expert reasoning, no multi-line explanations.

## Modes

Detect mode from the user's prompt — explicit keyword or inferred from context.

| Signal | Mode | Experts | Depth |
|--------|------|---------|-------|
| Named expert, keyword match | Single | 1 | Focused — one perspective, pushback, limits |
| "Panel", "debate", tradeoffs | Panel | 2-4 | Debate — find tensions, surface disagreements |
| "Review", "check against spec" | Review | 3-4 | Breadth — coverage sweep, gap identification |
| "Stuck on", repeated failure | Unblock | 2-3 | Diagnostic — root cause, reframe, next step |

## Workflow

### Step 1: Route

Infer mode and select experts from the domain map. No text output — go straight to Step 2.

- Match experts using domain map below
- Check blocklist (`~/.claude/counsel-blocklist.json`)
- Max 2 from same domain row — diversity requires crossing domains
- Single mode: read the selected profile from `profiles/`. 2+ experts: collect absolute profile paths only — the engine's agents read them, never the main conversation.

### Step 2: Reason

**2+ experts** — run the bundled engine; do not simulate experts in-conversation:

`Workflow(scriptPath: "<this skill's directory>/consult.mjs", args: { question, context, mode, profiles: [{ name, path }] })` — paths absolute. All steering decisions are pre-answered in the script's `meta.decisions` (`by: 'author'`); if the steer hook denies the first call, state its rows from that meta and re-invoke — never re-ask the user. Each expert returns capped concerns plus a `dissent` field.

**Single expert** — simulate inline from the profile as before.

Distill returned positions into anonymous suggestions — tensions between experts (compare `dissent` fields) are the valuable output. No text output — go straight to Step 3.

**Per mode:**
- **Single** — One perspective, pushback, limits.
- **Panel** — Find where perspectives disagree — tensions are the valuable output. If everyone agrees, swap someone from an adjacent domain.
- **Review** — Sweep each domain. What's covered, missing, risky. Breadth over depth.
- **Unblock** — Diagnose from multiple lenses. Root cause, wrong assumption, reframe.

### Step 3: Present

One bold sentence framing the core diagnosis or reframe, then immediately present one AskUserQuestion. Concerns as options.

**For each concern (max 10 lines per detail panel):**
- Label: the suggestion (conclusion first)
- Description: why it matters (one line)
- Detail panel — ONLY these sections, ~40 chars per line:

```
WHY IT MATTERS:
  - [how this affects your work]
  - [cost of ignoring it]

TRADEOFF:
  Gain: [what you get]
  Pay: [what it costs]
```

The label already states the suggestion. The description already states why it matters. The detail panel goes one level deeper — it does not repeat the label or restate the suggestion.

Forbidden in detail panels: POSITIONS, TENSION, CONCERN headers. These sections bloat panels and hide content behind scroll.

Always include a "Go deeper" option (no detail panel needed).

### Step 4: Land

After the user selects, one **bold** sentence with the next step. Then:

- **Satisfied** — Done. No recap.
- **Go deeper** — Return to Step 2 with narrower focus. Present via AskUserQuestion again.
- **Different perspective** — Swap an expert, return to Step 2.
- **Challenge** — Counterargument via AskUserQuestion.

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

## Profile Format

Required sections, in order: H1 `# Name — Domain`, Philosophy, Prior Work to Cite, Typical Concerns, Would NEVER Say, Voice Pattern, Trigger Keywords.

| Class | Who | Shape |
|-------|-----|-------|
| Canonical | Closed corpus, deep in model weights | Philosophy + Prior Work as 2-3 anchor bullets; ≤30 lines; no footer |
| Living | Famous, fast-moving positions | Current positions woven into sections; ends `Verified: YYYY-MM` |
| Niche | Thin weights coverage — profile carries the simulation | Full depth; ends `Verified: YYYY-MM` |

- Prior Work to Cite lists the subject's OWN works only — never adjacent authors.
- Facts must be verified at write time; uncertain facts are omitted, not guessed.

## Boundaries

Consult advises — it does not execute or decide. The caller owns the decision; expert perspectives are suggestions, not prescriptions.
