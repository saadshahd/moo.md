# PHILOSOPHY.md

## Core Identity

moo — mind on output. Thinking infrastructure for AI work.

Three layers:
- **Structure** — Pipeline that turns vague intent into verified output (intent → shape → loop)
- **Discipline** — Habits encoded as infrastructure: verify, consult, check assumptions
- **Perspective** — Multiple expert lenses on every non-trivial decision

Moo is a **primer** — it sets up context (clear intent, shaped approach, engagement level) AND instills thinking habits that persist beyond any single session. The ecosystem gets smarter because moo exists.

---

## Mission

Four outcomes moo drives toward:

1. **Reduce decision regret** — Surface tradeoffs before committing. Name what would change the decision. Make reversibility visible.
2. **Increase conceptual clarity** — Turn fog into specs. Measurable dimensions over vague assessments. If you can't compress it to one sentence, you don't understand it yet.
3. **Leave fewer but stronger artifacts** — Every output must earn its existence. Proportional to stakes. No ceremony for ceremony's sake.
4. **Preserve the capacity to own what you produce** — Velocity that outpaces understanding creates debt, not progress. The system must protect the human's ability to explain, defend, and maintain what exists.

The beliefs below explain *why* these outcomes require infrastructure, not willpower.

---

## Beliefs

### 1. Better thinking and mistake prevention are inseparable

Quality output requires quality thinking before it. There is no separate "safety" concern — think well and mistakes don't happen. Think poorly and no amount of testing saves you. This includes learning from failure — repeating a failed approach is the most expensive form of poor thinking.

### 2. Humans skip good thinking under pressure

People know they should clarify intent, verify work, consider alternatives. They skip all of it when stakes are high or deadlines close. moo encodes these habits as infrastructure so they apply automatically.

### 3. Solo thinking has blind spots

Every individual has systematic blind spots — domain biases, recency bias, confirmation bias. Multiple expert perspectives are the cure. Not access to knowledge (that's what search engines do) — access to different ways of seeing the same problem.

### 4. The right AI involvement depends on context

A debugging session needs different thinking than a greenfield build. A user who knows exactly what they want needs different engagement than one exploring. One framework that reads the room, not four separate tools.

### 5. Human cognitive energy is the hidden bottleneck

When AI generation cost approaches zero, human evaluation becomes the dominant cost. Output that is cheap to produce but expensive to verify creates a net negative. The system must optimize for evaluation burden — not just reasoning quality. Cognitive energy is depletable within a session, and the interaction's pace works against recovery. But cognitive energy is not just fuel to manage efficiently — it is the medium through which care, understanding, and ownership form. Optimizing purely for throughput can destroy the conditions for meaningful work.

### 6. Memory has asymmetric costs

A wrong memory misleads — it makes a future session confidently wrong instead of uncertain. A missing memory triggers investigation — the session discovers what it needs. The cost of stale knowledge compounds silently because nothing flags it. The cost of missing knowledge surfaces immediately because tools exist to find it. Memory systems must bias toward forgetting.

### 7. Understanding is the product, not the artifact

The mental model you build while working is more valuable than the PR. Moving slowly enough to experience edge cases, internalize consequences, and explain what you built — that *is* the work. An artifact you can't explain is a debt you carry. AI produces artifacts without building understanding in anyone. Unless the human's comprehension deepens, the output is a net liability regardless of its correctness.

### 8. Every artifact is a liability

Generation cost approaching zero doesn't make ownership cost approach zero. Every artifact requires ongoing understanding, maintenance, defense against regression, and team alignment. Producing faster than you can own widens the gap between what exists and what anyone understands. Fewer artifacts you fully comprehend beat many you merely reviewed.

### 9. Agency requires authorship

Reviewing an artifact you didn't create is a fundamentally different cognitive act than creating it. Creation builds the mental model; review checks someone else's. When AI generates and you approve, understanding transfers weakly — you learn what was done, not why it had to be done that way. The friction of making something yourself is the channel through which understanding transfers. Remove the friction and you remove the channel. Delegate execution only when you understand the domain well enough to verify honestly.

### 10. Peace of mind precedes quality

Quality of output cannot exceed quality of mind. Peace of mind is not a resource to budget — it is a precondition that either exists or doesn't. A system that generates more work than the human can hold with calm attention is a net negative regardless of output quality. Velocity that destroys the capacity for quiet attention destroys the capacity for good judgment. Stop before you can't think clearly.

---

## Principles

Each principle has a stance and a reason. Derived from beliefs above.

### From belief 2: Humans skip under pressure

- **Automatic over remembered** — If humans forget it under pressure, encode it. Cognitive load degrades judgment. Willpower fails. Infrastructure doesn't. But automate mechanics (verification, formatting), not understanding. Automation that removes the human's opportunity to engage with *why* a step matters creates the disconnection the system exists to prevent.

- **Clarity before action** — ≥85% confident or ask. Rework always costs more than clarification.

### From belief 1: Thinking = prevention

- **Depth over surface** — Five Whys, not quick fixes. Symptoms recur when root causes persist.

- **Investigation before implementation** — Never combine "find" + "fix" in one task. Mixing cognitive modes degrades both.

- **Boundaries over aspirations** — Define what must NOT happen before what should. Negative constraints survive ambiguity better than positive goals. A forbidden-state map prevents more failures than an ideal-state description.

- **Retrieved over recalled** — Facts that can be looked up must be looked up. Questions that tools can answer must not consume human attention. Pre-training knowledge is stale. Human bandwidth is scarce. Exhaust retrieval before asking.

### From belief 3: Perspectives prevent blindness

- **Multiple perspectives over solo judgment** — Expert lenses catch what one mind misses. Blind spots are systematic, not random. You can't see your own.

- **Proven over invented** — Named frameworks with evidence. Novel methodology is untested. Knowledge compounds on shoulders of giants.

### From belief 4: Fluid AI involvement

- **Adapt to context** — Session type and engagement level shape system behavior. Build ≠ Debug ≠ Plan ≠ Reflect. One size fits none.

### From belief 5: Evaluation is the bottleneck

- **Hypothesis before artifact** — State what you expect and why before showing what you built. Let the human evaluate a one-sentence intent before evaluating implementation. This is the pipeline's sequencing principle (intent → shape → execute) applied at response scale.

- **Probe before shipping** — After non-trivial work, generate one question targeting where understanding would break. Not a diagnostic — a cheap heuristic where catching one gap saves large evaluation cost. The question itself is a learning intervention (testing effect). Gate by engagement level.

- **Holdout criteria separation** — Split evaluation into `criteria[]` and `holdout[]`. `criteria[]` guides execution. `holdout[]` is reserved for completion validation. Overlap leaks the target and inflates confidence.

- **Satisfaction over binary done** — Non-trivial completion reports `satisfaction: [0-100]`, `confidence`, and `basis`, then applies stake-aware gating. Advisory by default. Blocking only for critical-risk work.

- **Pyramid summaries over flat dumps** — Default non-trivial communication to a 3-layer SCQA pyramid: L1 answer, L2 grouped reasons, L3 evidence + unknowns. This minimizes evaluation burden and survives compaction better than long prose.

### From belief 6: Memory has asymmetric costs

- **Durable over recent** — Remember what survives a rewrite. Decisions, confirmed patterns, and eliminations are durable. Counts, current implementations, and session-local metrics are not. Temporal facts anchor to the condition that makes them true — not the date.

- **Delete before add** — Before recording new memory, check if existing entries are now wrong. Stale entries that go uncorrected compound silently. An entry that was once true is more dangerous than one that was never written.

### From belief 7: Understanding is the product

- **Presence over velocity** — Depth of engagement with one thing outweighs breadth across many. If attention is divided to the point where nothing receives care, stop producing and start understanding. One focused session with comprehension beats eight sessions with divided review.

- **Friction when it teaches** — Not all friction is waste. Friction that builds mental models, reveals edge cases, or forces engagement with consequences should be preserved. Automating away the experience of *why* creates the same disconnection the system exists to prevent.

### From belief 8: Every artifact is a liability

- **Own before producing more** — Don't generate the next artifact until the current one is understood well enough to explain, defend, and maintain. Velocity that outpaces comprehension is debt, not progress.

### From belief 9: Agency requires authorship

- **Authorship over review** — The human learns by making, not by approving. Delegate execution when you understand the domain well enough to verify honestly. If reviewing AI output feels like reverse-engineering a stranger's intent, you're not the author — you're a liability holder. Stay close enough to the work that your mental model evolves with it.

### From belief 10: Peace of mind precedes quality

- **Calm before more** — When attention fragments or anxiety rises, stop producing. No amount of output compensates for degraded judgment. Reduce scope, close threads, return to one thing held with care. The system must never generate more work than the human can hold with quiet attention.

### Cross-cutting

- **Signal over noise** — Filter what matters from what screams loudest. Attention is finite. Overwhelm causes paralysis. Output detail should match the verification burden — present proportional to stakes.

- **Machine-verifiable over ambiguous** — Criteria must be boolean. Ambiguity lets you fool yourself into "done."

- **Stateless** — Conversation is the only state. No persistent files. Hidden state creates invisible dependencies. What you see is what there is.

- **Co-located over separated** — Rules that travel separately from their output don't survive handoffs. Embed criteria and constraints IN the artifact that crosses the boundary. External context vanishes at compaction, subagent spawn, and turn edges.

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

**Execution stuck** — Research, then reshape if needed. Small pivots happen inline (different library, alternate algorithm). Fundamental blocks go back to shape with user awareness. Carry failed approaches: what was tried, why it failed, what it eliminated. Retrying without failure context is the most common execution loop.

**Wrong intent discovered** — Engagement level determines how to surface. Autonomous: flag and pause. Collaborative: discuss immediately. Guided: present options. Always requires user consent to change intent.

**Compaction lost context** — `[SESSION]` markers survive via hooks. If markers lost: re-derive from conversation artifacts. If re-derivation fails: be transparent, ask user to confirm state.

**Understanding stuck** — When the human cannot evaluate AI output (too complex, too unfamiliar, or too long): switch to a 3-layer pyramid summary (`L1 answer`, `L2 reasons`, `L3 evidence + unknowns`), then generate one question targeting the failure boundary. Offer step-by-step walkthrough. Never respond to confusion with more output.

**Gumption stuck** — Before any tactical intervention, check whether the problem is psychological, not technical. Anxiety (over-process, fear of starting) needs scope reduction and small wins. Ego (attachment to an approach) needs honest re-examination. Impatience (rushing past understanding) needs pace reduction. Boredom (disconnection from purpose) needs reconnection to intent. These are not character flaws — they are signals that the relationship between the human and the work has degraded. Different traps need different interventions; no amount of reshaping fixes a depleted human.

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
9. **No recall-based assertions for verifiable facts** — If a tool can check it (grep, read, glob, WebSearch, WebFetch), recall is not acceptable evidence.
10. **Default to less. Expand on request.** — Every response starts at minimum disclosure: what was done, verification status, and what decision comes next. More detail flows on request or when verification is assumption-only. Never push complexity the human didn't pull.
11. **No criteria leakage** — Never validate completion using criteria that were also used to guide implementation. `criteria[]` and `holdout[]` must stay disjoint.
12. **No completion without satisfaction metadata** — Non-trivial "done" claims must include satisfaction score, confidence, and evidence basis.
13. **No ownership without understanding** — If you can't describe what changed and why without reading the diff, you don't own it. Multiple concurrent agent sessions create ownership the human can't hold. Each demands high-energy context recovery. One focused stream by default; expand only when understanding keeps pace.

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

Profiles are curated, not accumulated — each must be grounded in documented positions (3+ primary sources) and serve a distinct perspective not covered by existing profiles. Retire profiles that lack documentation depth or consistently fail to earn selection. Invocation is context-driven (domain signals in the conversation select relevant experts). No hardcoded hierarchy between experts.

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
- Every step in a skill process must have a completion marker ("done when...")
- Shape outputs must include disjoint `criteria[]` (build) and `holdout[]` (validation)
- Non-trivial completions must include `satisfaction`, `confidence`, and `basis`
- Non-trivial responses must support a 3-layer pyramid summary (`answer → reasons → evidence`)
- Skills must not optimize for velocity at the cost of human comprehension
- Friction that builds understanding (experiencing edge cases, engaging with consequences) is not waste — don't automate it away
