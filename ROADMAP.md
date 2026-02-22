# Roadmap

## Active
- Agentic coding memory system — custom MCP server with feelings-guided retrieval (2026-02-18)
  - 3-layer: storage (Qdrant/LanceDB) + memory intelligence (custom ranking) + hooks
  - Valence tagging, configurable scoring formula, session ingestion pipeline
  - Note: ledger skill deferred — Claude Code native memory covers basic recall, MCP server targets real gaps

## Ideas

## Decisions
- [x] Deep philosophy audit — 20 findings, 6 categories (2026-02-22)
  - 3 hard contradictions: Skill() calls vs loose coupling, enforcement vs advisory gates, no framework provenance
  - Critical drift: beliefs 7-10 have zero skill implementation (authorship, ownership, pace, peace)
  - 4 statechart misalignments: loop terminal vs verify transition, satisfaction <60, marker format, full→bond
  - 3 stale docs: PHILOSOPHY.md (6→10 skills, 42→74 profiles), marketplace.json (8→10 skills)
  - Priority: resolve coupling tension, implement beliefs 7-10 in soul/loop/bond, align gate semantics
- [x] Literary philosophy audit — beliefs 7-8, presence/friction/ownership principles (2026-02-22)
  - Sources: "One Flew Over the Context Window" blog, Pirsig (Zen/Motorcycle), Crawford (Shop Class)
  - Convergence: understanding forms through engagement, not review; ownership has irreducible cost
  - New beliefs: understanding-as-product (#7), artifact-as-liability (#8)
  - New principles: presence over velocity, friction when it teaches, own before producing more
  - New unstuck type: gumption traps (anxiety/ego/impatience/boredom)
  - Mission expanded 3→4 outcomes; "automatic over remembered" caveated
- [x] Phase 2 gap analysis — beliefs 9-10, constraint 13, authorship principle (2026-02-22)
  - Three-text triangulation: shared thesis = "Quality requires contact with reality + coherent authorship"
  - Redundant: belief 5 update (already covered), pace-over-velocity (= presence-over-velocity), 2nd audit item
  - Implemented: belief 9 (agency/authorship), belief 10 (peace of mind), constraint 13, 2 principles, 1 audit item
- [x] Memory as thinking principle — belief 6, soul principle 8, action directive (2026-02-21)
  - No Stop hook — embed guidance in system prompt, not gate exit
  - MEMORY.md self-reference reinforces per-project
  - Project Stop hook slimmed to roadmap-only
- [x] verify + observe skills — parallel pre-flight verification + codebase health assessment (2026-02-19)
  - Research: Factory.ai Agent Readiness (8 axes), StrongDM Software Factory (scenario testing), Anthropic 2026 Trends
  - verify: 4 parallel specialists (correctness, security, performance, standards) → SHIP/FIX/BLOCK gate
  - observe: 5 health dimensions (type safety, patterns, tests, deps, dead code) → health card
  - Ledger skill deferred: Claude Code native memory sufficient, MCP server targets real gaps
- [x] Factory-inspired verification — holdout separation, satisfaction scoring, pyramids (2026-02-19)
  - StrongDM Software Factory research → 3 adapted concepts, 2 new constraints, 3 new principles
  - criteria[] guides, holdout[] evaluates, mustNot[] prevents — disjoint by design
- [x] Roadmap surfacing via hooks — SessionStart, PostToolUse guard, Stop nudge (2026-02-14)
- [x] Stop hook: command over prompt — deterministic bash avoids haiku JSON failures (2026-02-14)
- [x] PR #21 research distillation — 2 new principles, 1 belief deepening, no new beliefs (2026-02-14)
- [x] Consult output: concern-oriented over expert-oriented, prohibitions over templates (2026-02-14)

## Parked
