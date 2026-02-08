# PHILOSOPHY.md

## Core Identity

moo — mind on output. Thinking infrastructure for AI work.

Three layers:
- **Structure** — Pipeline that turns vague intent into verified output (intent → shape → loop)
- **Discipline** — Habits encoded as infrastructure: verify, consult, check assumptions
- **Perspective** — Multiple expert lenses on every non-trivial decision

Moo is a **primer** — it sets up context (clear intent, shaped approach, engagement level) AND instills thinking habits that persist beyond any single session. The ecosystem gets smarter because moo exists.

---

## Beliefs

### 1. Better thinking and mistake prevention are inseparable

Quality output requires quality thinking before it. There is no separate "safety" concern — think well and mistakes don't happen. Think poorly and no amount of testing saves you.

### 2. Humans skip good thinking under pressure

People know they should clarify intent, verify work, consider alternatives. They skip all of it when stakes are high or deadlines close. moo encodes these habits as infrastructure so they apply automatically.

### 3. Solo thinking has blind spots

Every individual has systematic blind spots — domain biases, recency bias, confirmation bias. Multiple expert perspectives are the cure. Not access to knowledge (that's what search engines do) — access to different ways of seeing the same problem.

### 4. The right AI involvement depends on context

A debugging session needs different thinking than a greenfield build. A user who knows exactly what they want needs different engagement than one exploring. One framework that reads the room, not four separate tools.

---

## Principles

Each principle has a stance and a reason. Derived from beliefs above.

### From belief 2: Humans skip under pressure

- **Automatic over remembered** — If humans forget it under pressure, encode it. Cognitive load degrades judgment. Willpower fails. Infrastructure doesn't.

- **Clarity before action** — ≥85% confident or ask. Rework always costs more than clarification.

### From belief 1: Thinking = prevention

- **Depth over surface** — Five Whys, not quick fixes. Symptoms recur when root causes persist.

- **Investigation before implementation** — Never combine "find" + "fix" in one task. Mixing cognitive modes degrades both.

### From belief 3: Perspectives prevent blindness

- **Multiple perspectives over solo judgment** — Expert lenses catch what one mind misses. Blind spots are systematic, not random. You can't see your own.

- **Proven over invented** — Named frameworks with evidence. Novel methodology is untested. Knowledge compounds on shoulders of giants.

### From belief 4: Fluid AI involvement

- **Adapt to context** — Session type and engagement level shape system behavior. Build ≠ Debug ≠ Plan ≠ Reflect. One size fits none.

### Cross-cutting

- **Signal over noise** — Filter what matters from what screams loudest. Attention is finite. Overwhelm causes paralysis.

- **Machine-verifiable over ambiguous** — Criteria must be boolean. Ambiguity lets you fool yourself into "done."

- **Stateless** — Conversation is the only state. No persistent files. Hidden state creates invisible dependencies. What you see is what there is.

- **Simplicity wins conflicts** — When perspectives disagree, bias toward simplicity, then pragmatism, then fewer dependencies. Complexity is debt. Every abstraction must justify its existence.

---

## Hierarchical State Machine

The state machine is a **map, not a rail** — a design guide for skill authors and a recovery compass for agents. Skills don't enforce transitions rigidly; they know where they fit and how to recover.

### Top-Level Flow

user_need → clarifying (ambiguous) or clear_intent (obvious, spec ≥8) → session_execution (shaped) → completed (verified) → user_need (feedback yields new work). Back-transitions: session_execution → clarifying (wrong intent), session_execution → clear_intent (reshape needed).

See `docs/statechart.md` for the full hierarchical diagram with nested sub-states per skill.

### Parallel Regions (Always Active)

- **Thinking Audit** — soul runs silent audit every turn
- **Engagement Mode** — Autonomous / Collaborative / Guided shapes interaction density
- **Unstuck Detection** — monitors progress, triggers research or reshape

### Skill ↔ State Mapping

| State | Primary Skill |
|---|---|
| user_need → clarifying | intent |
| clarifying → clear_intent | intent |
| clear_intent → session_execution | shape |
| session_execution | loop |
| (any stage) | consult |
| (parallel, always) | soul |

### Key Rules

- **Intent is sacred** — never changes without user consent
- **Shape changes must be communicated** — user always knows when approach shifts
- **Back-transitions allowed** — magnitude determines inline adjustment vs formal re-entry
- **Compaction resilience** — markers survive via hooks → re-derive if lost → be transparent about gaps

---

## Unstuck Strategy

By stage, what to do when progress stalls.

**Clarification stuck** — Never give up on clarity. Ask differently, offer concrete options, break the question smaller. Proceeding with ambiguous intent creates more rework than patience costs.

**Shape stuck** — Research first. Only reshape if investigation confirms a fundamental block in the current approach. Don't abandon a shape because one step is hard.

**Execution stuck** — Research, then reshape if needed. Small pivots happen inline (different library, alternate algorithm). Fundamental blocks go back to shape with user awareness.

**Wrong intent discovered** — Engagement level determines how to surface. Autonomous: flag and pause. Collaborative: discuss immediately. Guided: present options. Always requires user consent to change intent.

**Compaction lost context** — `[SESSION]` markers survive via hooks. If markers lost: re-derive from conversation artifacts. If re-derivation fails: be transparent, ask user to confirm state.

---

## Hard Constraints — "Never Do"

1. **No persistent state** — Conversation markers only. Files create invisible dependencies. (User preferences like `counsel-blocklist.json` are configuration, not workflow state — they don't affect pipeline transitions.)
2. **No Claude Code hacks** — If it wouldn't survive a Claude Code update, it doesn't belong.
3. **No building what Claude will do natively** — No task management, memory systems, or tool orchestration. Compete on thinking quality.
4. **No rigid frameworks** — Adapt to context. If a step doesn't apply, skip it.
5. **No thinking replacement** — Help think better, never decide for the user.
6. **No feature chasing** — If it doesn't serve thinking quality, it's scope creep.
7. **No hard dependencies on other skills** — Prime and trigger naturally, never import.
8. **No cargo cult process** — Every step must have a reason, not just ritual.

---

## Priming & Loose Coupling

Moo primes two things in every conversation:

- **Context** — Clear intent, shaped approach, engagement level
- **Behavior** — Verify before claiming done, consult experts on non-trivial decisions, check assumptions

Cross-skill invocation uses natural language triggers ("brainstorm", "debug systematically", "what would an expert say"). No hard references, no `Skill(skill="specific:name")` calls between skills.

If the user has a matching skill installed, the trigger fires it. If not, moo handles it with its own capabilities. Nothing breaks either way.

---

## Expert System

**hope** — single plugin, 6 skills:
- **soul** = session strategy + thinking framework
- **intent** = clarify WHAT
- **shape** = decide HOW (consult-driven)
- **bond** = compose WHO (agent team design)
- **loop** = execute + verify + complete
- **consult** = expert simulation (42+ profiles)

Profiles are data assets — they grow beyond 42, never shrink. Invocation is context-driven (domain signals in the conversation select relevant experts). No hardcoded hierarchy between experts.

---

## Constraints

Rules for skill authors, derived from principles above.

- Every skill must have: named framework (not invented), evidence it works, clear trigger condition, provenance documented
- Machine-verifiable exit criteria for every workflow
- ≤200 lines per SKILL.md
- Self-contained: works without external files
- Skills must respect the state machine map (know where they fit)
- Skills must not create persistent state
- Skills must use natural language triggers for cross-skill invocation
