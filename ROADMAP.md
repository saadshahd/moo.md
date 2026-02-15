# Roadmap

## Active

- [ ] Strengthen SessionStart action directive for better auto-trigger reliability (audit H3)
- [ ] Co-locate key guidance in loop/bond Task prompts since subagents lack skills (audit H2)
- [ ] Bond graceful degradation when Agent Teams experimental flag is off (audit M5)

## Ideas

## Decisions
- [x] Explore mode added to consult — 5th mode for generative discovery (2026-02-15)
- [x] Sizing-aware output scaling — intent/shape emit Trivial/Standard/Critical briefs (2026-02-15)
- [x] Loose coupling rule removed — explicit Skill() calls are correct (2026-02-15)
- [x] Forge skill removed — unused, agent creation is native Claude Code (2026-02-15)
- [x] Full plugin audit — 5 critical, 4 high, 6 medium findings documented (2026-02-15)
- [x] Plugin hooks for marketplace still broken (#12151, #16538) — no action possible (2026-02-15)
- [x] Roadmap surfacing via hooks — SessionStart, PostToolUse guard, Stop nudge (2026-02-14)
- [x] Stop hook: command over prompt — deterministic bash avoids haiku JSON failures (2026-02-14)
- [x] PR #21 research distillation — 2 new principles, 1 belief deepening, no new beliefs (2026-02-14)
- [x] Consult output: concern-oriented over expert-oriented, prohibitions over templates (2026-02-14)
- [x] Description pattern: WHAT+WHEN over trigger-only — per Anthropic guide (2026-02-15)
- [x] argument-hint convention adopted for all commands that accept arguments (2026-02-15)

## Parked
