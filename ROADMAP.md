# Roadmap

## Active
- Agentic coding memory system — custom MCP server with feelings-guided retrieval (2026-02-18)
  - 3-layer: storage (Qdrant/LanceDB) + memory intelligence (custom ranking) + hooks
  - Valence tagging, configurable scoring formula, session ingestion pipeline
  - Note: ledger skill deferred — Claude Code native memory covers basic recall, MCP server targets real gaps

## Ideas

## Decisions
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
