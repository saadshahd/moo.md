# Roadmap

## Active
- Agentic coding memory system — custom MCP server with feelings-guided retrieval (2026-02-18)
  - 3-layer: storage (Qdrant/LanceDB) + memory intelligence (custom ranking) + hooks
  - Valence tagging, configurable scoring formula, session ingestion pipeline
  - Note: ledger skill deferred — Claude Code native memory covers basic recall, MCP server targets real gaps

## Ideas
- opensrc skill for kit — context enrichment via dependency source code (vercel-labs/opensrc)
  - Deferred: standalone CLI with minimal wrapping value as a skill

## Decisions
- [x] Kit skills redesign — flows over CLI docs (2026-02-22)
  - Rewrite: browser (161→132), portless (132→106), debug (141→125) — less lines, more judgment
  - Structure: Role + Rules (invariants) + Decision Tables (when) + Flows (how) + Anti-patterns
  - Commands inline within flows only — no standalone reference tables
  - Pattern follows hope:loop (Role + Principles + Flow) and hope:search (decision tables)
  - 18 command syntax errors from initial grounding now irrelevant — commands embedded in context
- [x] Kit first skills — browser, portless, debug (2026-02-22)
  - Research: vercel-labs/agent-browser (14.9K★, v0.13.0), portless (2K★, v0.4.1), dev3000 (970★, canary)
  - opensrc deferred: standalone CLI, minimal wrapping value
  - No hooks: "fail loud, recover quiet" — let commands fail visibly, no preventive ceremony
  - No dev-env meta-skill: composition emerges from good interfaces, not orchestration layers
  - No plugin.json update yet — skills land first, version bump on release
  - Grounding: each skill adapted from source repo SKILL.md/CLI, verified against actual command parser
  - 18 command syntax errors caught in code review — source verification essential for reference cards
- [x] Philosophy hierarchy + kit plugin scaffold (2026-02-22)
  - Root PHILOSOPHY.md → minimal (identity + mission only, 32 lines from 271)
  - hope/PHILOSOPHY.md created — all 10 beliefs, 16 principles, 13 constraints, statechart, unstuck
  - kit plugin scaffolded — 5 beliefs (invisible, composable, AI-native, speed+awareness, env=infra)
  - CLAUDE.md inline beliefs replaced with plugin philosophy references
  - User chose: truly minimal root (no shared belief layer), structured-but-flexible plugin format
- [x] Deep philosophy audit — skills vs PHILOSOPHY.md structural alignment (2026-02-22)
  - Finding: beliefs 7/9/10 (understanding, authorship, peace of mind) least mechanized
  - Artifact quality rigorously protected; human comprehension had no structural enforcement
  - 10 findings: 3 contradictions, 3 missing embodiments, 4 superficial compliance
  - Fixes: 54 lines across 6 files — modify existing mechanisms, no new abstractions
  - Meta: subagents = context infrastructure (not delegation); team mode = understanding channel
  - Meta: can't enforce "user decides" by deciding for them — surface info, let user choose
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
