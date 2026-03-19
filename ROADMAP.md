# Roadmap

## Active
- Agentic coding memory system — custom MCP server with feelings-guided retrieval (2026-02-18)
  - 3-layer: storage (Qdrant/LanceDB) + memory intelligence (custom ranking) + hooks
  - Valence tagging, configurable scoring formula, session ingestion pipeline
  - Note: ledger skill deferred — Claude Code native memory covers basic recall, MCP server targets real gaps

## Next
- Shape skill eval testing + calibration
  - Run evals against real user sessions — compare skill output quality with/without shape
  - Report results: does the structured workflow (dimensions, expert consult, pre-mortem) produce better implementation decisions than unguided shaping?
  - Known gaps from eval iterations:
    - Type 2 lighter treatment never fires — skill gives all dimensions equal depth regardless of reversibility
    - Single-dimension collapse (SKILL.md line 8) never triggers — skill finds multiple dimensions in every prompt tested
  - Decision pending: fix in SKILL.md or accept as behavior (user testing will inform)

## Decisions
- [x] hope v4 rewrite complete — 10 skills / ~1380 lines → 4 skills / 147 lines (2026-03-01)
  - Removed: loop, soul, verify, observe, forge, search
  - Rewrote: intent (22L), shape (23L), consult (67L), bond (35L). Full is command-only.
  - Philosophy: manifesto tone (92L), humble-master integration, "prior art first" principle
  - Hooks: all removed (SessionStart, SubagentStart, PreToolUse, PreCompact)
  - No factory metaphors: criteria[], holdout[], mustNot[], satisfaction, waves, zones eliminated
  - See: openspec/changes/hope-v4-rewrite/
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
  - Key insight: executing agents treat skill refs as suggestions unless plans read as protocols
- [x] Cognitive risk zones — 3rd classification axis in soul (2026-02-22)
  - Research: models don't self-diagnose; extended thinking hurts on high-complexity tasks
  - 3 dimensions: novelty, reasoning depth, freshness. Highest wins → Zone 1/2/3
  - Zone 1 = zero overhead. Zone 3 = decompose regardless of sizing, retrieval-first, min Collaborative
  - Cascades: shape adds retrieval criteria/mustNot, loop decomposes + retrieval per item
  - Key insight: decomposition reduces constraints per sub-problem to Zone 1-2 where reasoning works
  - Orthogonal to sizing (scope) and risk tier (blast radius) — cognitive risk is a distinct axis
- [x] Philosophy hierarchy + deep audit + literary audit (2026-02-22)
  - 10 beliefs, 16 principles, 13 constraints mechanized; beliefs 7-10 from literary sources
  - Key: understanding-as-product, artifact-as-liability, presence over velocity, friction when it teaches
- [x] Phase 2 gap analysis — beliefs 9-10, constraint 13, authorship principle (2026-02-22)
- [x] Memory as thinking principle — belief 6, soul principle 8, no Stop hook (2026-02-21)
- [x] verify + observe + holdout separation + satisfaction scoring (2026-02-19)
  - verify: 4 parallel specialists → SHIP/FIX/BLOCK. observe: 5 health dimensions → health card
  - criteria[] guides, holdout[] evaluates, mustNot[] prevents — disjoint by design
- [x] Foundation batch — roadmap hooks, stop hook, PR#21 distillation, consult output (2026-02-14)

## Parked
