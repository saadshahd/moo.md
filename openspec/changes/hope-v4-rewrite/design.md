## Context

hope v3.12.3 is a 10-skill pipeline plugin for Claude Code (~1380 lines). It grew from a simple philosophy primer into a behavioral specification engine with factory metaphors, DOT flowcharts, scoring formulas, and execution machinery. Meanwhile, Claude Code evolved: native task management, extended thinking, memory layers, and improved code review make most of hope's execution infrastructure redundant.

The v0.0.1 hope was a single file that read like sticky notes from a senior dev. The philosophy was the implementation. v4 recovers that.

Stack composition model: hope (thinking quality) + OpenSpec (durable artifacts) + kit (tooling) + claude-mem (memory). Each plugin owns one layer. No overlap.

## Goals / Non-Goals

**Goals:**

- 5 skills, ~200 total lines (from 10 skills, ~1380 lines)
- Mentor's notes tone everywhere — like a senior dev left you sticky notes, including philosophy
- Each skill fits on a screen. If you need to scroll, it's too long.
- Trust the platform for execution, verification, and task tracking
- Bond designs AND spawns teams (end-to-end, not assessment-only)
- Philosophy as manifesto: compressed beliefs, humble-master learnings, "prior art first" principle
- Natural language composition with OpenSpec (hope primes, OpenSpec picks up if installed)

**Non-Goals:**

- No persona or character (mechanism, not personality)
- No persistent state beyond OpenSpec artifacts
- No platform competition (task management, memory systems, tool orchestration)
- No factory metaphors (criteria[], holdout[], satisfaction tuples, waves, zones)
- No quality gate skill (trust Claude — if user wants review, they ask)
- No backward compatibility with v3.x skill formats
- No migration tooling (clean break, major version bump)

## Decisions

### 1. Kill 5 skills, rewrite 4, create 1

**Decision**: Remove loop, soul, verify, observe, forge, search. Rewrite intent, shape, consult, bond. Create full.

**Rationale**: Loop duplicates Claude Code's native execution. Soul's 174 lines of session orchestration distill to ~10 lines in full. Verify adds ceremony Claude handles natively when asked. Observe is useful but not hope's job. Forge is a one-off task. Search is reference docs.

**Alternative considered**: Keep loop as a thin wrapper around Claude's native execution → rejected because even the wrapper adds indirection without value. If Claude handles it, let Claude handle it.

### 2. Bond absorbs forge

**Decision**: Bond designs team structure AND creates agent files. One skill, end-to-end.

**Rationale**: The v3 split (bond assesses fitness → forge creates files) was a design-time abstraction that added a handoff without adding clarity. The user thinks "I need a team for this" — one skill should answer that.

**Alternative considered**: Keep forge as a separate "create single agent" skill → rejected because creating a single agent doesn't warrant a pipeline skill. It's a write operation.

### 3. Full absorbs soul

**Decision**: `full` is the pipeline entrypoint. It carries soul's session awareness (engagement level, pipeline phase detection) plus the skill sequence.

**Rationale**: Soul was hope's largest skill (174 lines) because it encoded per-turn audits, cognitive zones, verification gates, and 8 principles. Most of this is noise. The essential soul — "read the room, pick the right engagement level, know where you are in the pipeline" — fits in full's opening stanza.

**Alternative considered**: Keep soul as a standalone thinking framework → rejected because its value is inseparable from the pipeline context. A thinking framework without pipeline awareness is just principles, and those belong in PHILOSOPHY.md.

### 4. Manifesto-tone philosophy

**Decision**: Rewrite PHILOSOPHY.md in mentor's notes voice. Beliefs as 1-2 sentences. Principles as short stances. No academic paragraphs.

**Rationale**: v3 philosophy is 275 lines of carefully argued positions. It's correct but nobody reads it. A senior dev doesn't write essays on the whiteboard — they leave sharp notes that stick.

**New additions**:
- "Prior art first" — search before creating, reframe over replicate
- humble-master integration — correction reception, cost asymmetry awareness, advises/discloses/teaches
- Compressed constraints (13 → fewer, sharper)

### 5. Hook simplification

**Decision**: Remove exit-plan-gate sequential deny chain. Simplify PreCompact. Keep SessionStart and grep-deny hooks.

**Rationale**: The exit-plan-gate was hope's most complex hook — a 3-stage sequential deny chain checking pipeline artifacts, coverage verification, and self-containment. It required JSONL transcript parsing, assistant-text extraction, and careful scoping. All to enforce what a clear philosophy and 5-line instruction in full can accomplish: "don't claim done without evidence."

**Alternative considered**: Simplify the gate to a single check → rejected because even a simple gate is a mechanism solving a trust problem. If the skills are clear enough, the gate is unnecessary.

### 6. Natural language OpenSpec composition

**Decision**: hope primes with natural language ("you have a clear spec — propose it"). OpenSpec picks up if installed. No Skill() references, no detection logic.

**Rationale**: Loose coupling is a core hope principle. If hope detects OpenSpec and changes behavior, that's a hard dependency wearing a soft hat. Instead: hope does its thinking, suggests the natural next step in plain language, and the user (or their installed skills) handles the rest.

## Risks / Trade-offs

- **[Power users lose machinery]** → v3's scoring, gating, and holdout separation served users who wanted rigorous verification. v4 trades that for simplicity. Mitigation: users who want formal verification can install OpenSpec's verify or ask Claude directly.
- **[~200 lines may be too tight]** → Fitting 5 meaningful skills in ~200 total lines requires extreme compression. Risk of skills becoming too terse to guide behavior. Mitigation: each skill targets ~30-60 lines. If a skill can't fit, the design is wrong, not the budget.
- **[Breaking change adoption]** → v3 users must relearn. No migration path. Mitigation: major version bump (4.0.0) signals the break. v3 stays available. The simplification itself is the migration — less to learn, not different things to learn.
- **[Humble-master integration subtlety]** → Folding correction reception and cost asymmetry into philosophy requires careful phrasing. Too explicit = persona. Too subtle = invisible. Mitigation: test with real sessions. If it reads like a character description, rewrite.
- **[Profile curation for consult]** → 74 profiles → fewer curated profiles. Some domain coverage lost. Mitigation: keep profiles as data files, not skill lines. The skill references them; the budget constrains the skill, not the profiles.
