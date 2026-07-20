---
name: freeze
description: Use when a pipeline stage or the human meets facts that live outside the repo — a service, database, queue, third party, or live logs — and the work depends on their current state. Triggers on "what's the state of", "check prod", "is the service returning", "snapshot the data", external-system dependencies. Repo-local work skips it.
---

Freeze the moving cross-boundary state a system depends on into one immutable snapshot. Consumer: the agent stages (intent / shape / delegate / execute) — grounding, not narration.

## Contract

- **INPUT** — a system to ground + the work order (intent). Doubly scoped: only the slice of the world this work order touches, never a general map.
- **GATE** — "Is the snapshot factual and complete — every required fact observed, or an explicit gap?" Agent audits, user locks.
- **OUTPUT** — a snapshot VALUE, emitted in conversation. Stateless: nothing persisted; re-run to refresh.

## Observed-or-gap, never inference

A fact's value is OBSERVED or it is a GAP. No third path.

- Inference builds the source map only — WHICH facts matter. It never produces a fact's value.
- Observed = a read-only acquisition agent sees it live, or the human retrieves it by hand.
- WRONG: infer a value from a config file, a stale doc, or "probably still X".
- RIGHT: unreachable fact → OPEN gap with retrieval instructions, never a fabricated value.

## Snapshot shape

- **OBSERVED facts** — each `{ source, claim, where-it-lives, as-of, observed-by }`.
- **OPEN gaps** — each `{ required-fact, why-needed, where-to-look, how-to-retrieve }`.
- Any map/belief over the facts is a VIEW, marked derived, never mixed into the observed set.

## Work loop

1. **Scope** — from system + intent, infer the source map: the external facts this work order depends on. The only place inference runs.
2. **Acquire** — fan out read-only acquisition agents in parallel, one observation per fact, live (rules below).
3. **Fold** — each return → an OBSERVED fact; anything unobserved → an OPEN gap with retrieval instructions.
4. **Gap-fill** — surface gaps for the human to hand-retrieve; re-fold; recheck. Human-gated, no metric, no unsupervised run — does NOT pass through target. Ends when gaps close or the human stops; a snapshot with named open gaps is a valid lock.
5. **Gate** — audit below.

## Acquisition agents

Spawn acquisition agents and fold their returns — never read external systems yourself.

- **READ-ONLY hard guard** — observe, never mutate. No write, no state-changing POST, no migration, no toggle. An agent that would mutate → stop; make it a gap for the human.
- Independent facts go out as parallel agent calls in one message.
- Each prompt self-contained: the one fact, where it lives, the read-only constraint.

## Decision prompts

<!-- doc-gen FILE src=../prompts.md -->
Closing unknowns — three modes, one boundary:

- **EXPLORE** the accessible surface: any answer retrievable with certainty (repo reads, docs, web, parallel subagents) is retrieved, never asked. Return with decisions, not raw findings.
- **ELICIT** the user: only judgment calls no accessible surface can settle (their goal, taste, a tie between viable paths). Each AskUserQuestion: exactly 3 concrete candidate answers + 1 uniform "Gather facts" escape hatch (first-class option, never hidden behind Other). Everything needed to answer lives inside the question UI — question text, descriptions, previews — never in prose before the tool call (the dialog hides it).
- **INTERVIEWING** is the anti-pattern: serial quizzing, generic checklists, asking what exploration could answer.

Re-entry after a detour: if the detour made the answer obvious, state the decision and proceed; otherwise re-ask the same question with the new evidence inside the prompt.
<!-- end-doc-gen -->

## The gate

Agent audits, user locks.

- **Factual pass** — every OBSERVED fact traces to an observation (agent return or human hand-retrieval). An inferred value is a defect: demote to OPEN gap or re-acquire.
- **Completeness pass** — every source-map fact is OBSERVED or an OPEN gap. A silently absent required fact is the failure mode; name it as a gap.
- Verdict-FIRST via AskUserQuestion: PASSES or FAILS, then observed count and open gaps — proof both passes ran.
- On FAIL: name exactly which facts are inferred or missing. Never fabricate a value to close a gap.
- The lock is the user's, not yours.

## Boundaries

- **On-demand, not mandatory** — any stage invokes freeze on outside-the-repo facts; repo-local work skips it.
- **freeze vs over** — freeze is world→pipeline grounding (acquire external facts, feed the agent stages); over is output→human handoff. Complements, never folded together.
