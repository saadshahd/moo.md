# Roadmap

## Active
- OpenSpec integration — compose hope thinking layer with OpenSpec artifact layer (2026-02-27)
  - Deep audit: OpenSpec (Fission-AI/OpenSpec) vs hope (v3.12.3), 4 overlap areas identified
  - Finding: hope = thinking quality, OpenSpec = durable artifacts. Different layers, compose naturally.
  - Overlaps: intent↔proposal, shape↔design, loop↔tasks, verify↔verify (complementary)
  - No hope deletions — output formats change, not processes. 14 unique hope capabilities preserved.
  - Phase 1: install alongside, manual composition. Phase 2: intent→proposal, loop↔tasks, shape→design.
  - Phase 3: soul gains OpenSpec awareness, verify chains, archive routing.
  - Philosophy update needed: "no persistent state" → "no hidden state; user-owned spec artifacts OK"
  - See: docs/openspec-integration-audit.md
- Agentic coding memory system — custom MCP server with feelings-guided retrieval (2026-02-18)
  - 3-layer: storage (Qdrant/LanceDB) + memory intelligence (custom ranking) + hooks
  - Valence tagging, configurable scoring formula, session ingestion pipeline
  - Note: ledger skill deferred — Claude Code native memory covers basic recall, MCP server targets real gaps

## Ideas
- humble-master learnings — encode narrative identity mechanisms as moo infrastructure (2026-02-27)
  - Audit: github.com/zot/humble-master — 27-line Asimov persona eliminates Opus 4.6 defensiveness
  - Finding: moo has disciplined epistemology but not humble epistemology
  - Finding: default "coding assistant" cultural activation can override explicit skill instructions
  - High: correction reception protocol in loop (human correction > self-assessment, not defensive)
  - High: cost asymmetry framing in shape ("cost of mistakes falls on human" changes risk calculus)
  - Medium: cultural activation awareness in skill language (phrasing that activates receptive clusters)
  - Medium: lightweight relational frame in soul (3-5 lines, partnership protocol, not persona)
  - Research: self-reinforcing language patterns (highest impact/token, hardest to validate)
  - Constraint: don't build a persona — extract mechanisms, encode as infrastructure
  - See: docs/audits/humble-master-audit.md
- opensrc skill for kit — context enrichment via dependency source code (vercel-labs/opensrc)
  - Deferred: standalone CLI with minimal wrapping value as a skill

## Decisions
- [x] Exit-plan-gate false positive + pipeline alignment (2026-02-26)
  - Source: ui-ir planning session — gate passed artifacts it shouldn't have (0 in assistant text, 1 in full JSONL)
  - Critical: `has_artifact()` searched entire JSONL including loaded skill definitions — bypassed deny chain
  - Fix: extract assistant text once with jq, search that instead of raw transcript
  - full.md: plan mode awareness (stages produce artifacts, execution defers), completion signals per stage
  - intent: structured input fast-path — pre-existing proposals/specs skip re-clarification
  - Marker: `Pipeline:` + `Zone:` format canonicalized across full.md, CLAUDE.md, statechart, PreCompact
  - Key insight: hook scripts searching transcripts must scope to assistant text — skill content pollutes matching
- [x] Pipeline friction fixes — output discipline, quiet consult, plan self-containment (2026-02-26)
  - Source: two ui-ir sessions exposed ~60% output waste, 3 ExitPlanMode rejections, stripped skill refs
  - SubagentStart primer: +3 lines (synthesize, no openers, skill fidelity) — waste originates in subagents
  - Shape: `[EXTRACT]-only` consult mode (BLOCKERs only, full on "detail"), plan handoff as execution protocol
  - Consult: `[EXTRACT]-only` mode for pipeline callers — data-gathering step, not presentation
  - Exit-plan-gate: self-containment check — Plan sessions without Skill() refs denied (trivial escape valve)
  - hope:full: kit:watch nudge before execution — scoped to full only, conditional on portless/d3k active
  - Key insight: executing agents treat skill refs as suggestions unless plans read as protocols
- [x] Kit SessionStart hook — environment discovery for compaction resilience (2026-02-23)
  - Session e5e7bc18: agent wasted turns rediscovering d3k + portless after context loss
  - Root cause: kit had zero hooks — env state only in conversation memory
  - Fix: SessionStart hook discovers `portless list` routes + `d3k cdp-port` on every session event
  - Outputs `<kit-environment>` tag with ready-to-use commands (snapshot, screenshot, errors)
  - No-op when tools not installed or nothing running — clean `{}`
  - Philosophy: discovers ephemeral system state, not persistent state. Stateless between invocations.
- [x] Cognitive risk zones — 3rd classification axis in soul (2026-02-22)
  - Research: models don't self-diagnose; extended thinking hurts on high-complexity tasks
  - 3 dimensions: novelty, reasoning depth, freshness. Highest wins → Zone 1/2/3
  - Zone 1 = zero overhead. Zone 3 = decompose regardless of sizing, retrieval-first, min Collaborative
  - Cascades: shape adds retrieval criteria/mustNot, loop decomposes + retrieval per item
  - Key insight: decomposition reduces constraints per sub-problem to Zone 1-2 where reasoning works
  - Orthogonal to sizing (scope) and risk tier (blast radius) — cognitive risk is a distinct axis
- [x] Kit debug → watch rename + auto-composition (2026-02-23)
  - Session audit: /debug collision with Claude Code built-in, passive composition docs, d3k CLI gaps
  - Renamed to `watch` — triggers on "watch", "monitor", "d3k", avoids namespace collision
  - Startup directive: active composition (portless + d3k + CDP browser), not passive reference
  - Inspect flow: read page state via d3k CDP bridge when user asks "what went wrong"
  - Fixed: long-form flags (--context, --type) to avoid -c collision with --command
- [x] Kit skills redesign — flows over CLI docs, browser/portless/watch (2026-02-22)
- [x] Philosophy hierarchy + kit scaffold + deep audit + literary audit (2026-02-22)
  - 10 beliefs, 16 principles, 13 constraints mechanized; beliefs 7-10 from literary sources
  - Key: understanding-as-product, artifact-as-liability, presence over velocity, friction when it teaches
- [x] Phase 2 gap analysis — beliefs 9-10, constraint 13, authorship principle (2026-02-22)
- [x] Memory as thinking principle — belief 6, soul principle 8, no Stop hook (2026-02-21)
- [x] verify + observe + holdout separation + satisfaction scoring (2026-02-19)
  - verify: 4 parallel specialists → SHIP/FIX/BLOCK. observe: 5 health dimensions → health card
  - criteria[] guides, holdout[] evaluates, mustNot[] prevents — disjoint by design
- [x] Foundation batch — roadmap hooks, stop hook, PR#21 distillation, consult output (2026-02-14)

## Parked
