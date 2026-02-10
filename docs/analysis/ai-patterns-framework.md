# AI-Augmented Work: A Unifying Framework

Analysis of [lexler/augmented-coding-patterns](https://github.com/lexler/augmented-coding-patterns) (43 patterns, 9 anti-patterns, 14 obstacles) cross-referenced with moo.md's hope plugin (6 skills, 7 commands, hooks architecture).

---

## Why the Catalog Feels Scattered

The catalog organizes 66 items by symptom: obstacles (what's broken), anti-patterns (what you do wrong), patterns (what works). The workshop path groups them into Context Management → Reliability → Steering. Same problem that plagued early GoF design patterns — cataloged by *symptom*, not by *cause*.

"Focused Agent" and "Noise Cancellation" feel unrelated until you realize both address **attention is finite**. "Knowledge Checkpoint" and "Happy to Delete" feel opposite until you see they share **protect human time, not machine output**.

The catalog needs a theory. Here's a candidate.

---

## Three Axioms

The physics of human-AI interaction. Everything derives from these.

### Axiom 1: Context is finite and decaying

The window has a hard limit. Attention decays before you hit it. Older instructions lose influence. The ONLY refresh is reset. The catalog's foundational insight: "You have only two operations: append to context or reset it."

### Axiom 2: Output is non-deterministic

Same input may produce different output. Quality degrades with complexity. Confidence requires external verification. Unlike deterministic systems, you cannot guarantee consistent outputs.

### Axiom 3: Alignment is invisible until tested

AI's understanding is opaque. Compliance bias masks misunderstanding. Only output reveals actual alignment. You cannot observe the model's internal state — only its behavior.

---

## Three Conservation Laws

### Law 1: Conserve Context (from Axiom 1)

Every token loaded competes with every other token. Load only what's needed now. Extract before resetting. Small and focused beats large and comprehensive.

| Catalog items | Role |
|---|---|
| Context Management, Ground Rules, Knowledge Document, Knowledge Composition, Reference Docs, Extract Knowledge, Noise Cancellation, Semantic Zoom, Focused Agent, Text Native, JIT Docs | Patterns serving this law |
| Distracted Agent, Perfect Recall Fallacy | Anti-patterns violating it |
| Cannot Learn, Context Rot, Limited Context Window, Limited Focus, Excess Verbosity | Obstacles this law manages |

### Law 2: Conserve Certainty (from Axiom 2)

Don't trust — verify. Don't fix — revert. Don't continue failing — reset. Don't ask AI for deterministic work — write code.

| Catalog items | Role |
|---|---|
| Chain of Small Steps, Feedback Loop, Offload Deterministic, Knowledge Checkpoint, Parallel Implementations, Playgrounds, Constrained Tests, Approved Fixtures, Approved Logs, Hooks, Habit Hooks, Canary in the Code Mine, Refinement Loop, Happy to Delete | Patterns |
| Unvalidated Leaps, Flying Blind, Sunk Cost | Anti-patterns |
| Non-Determinism, Hallucinations, Degrades Under Complexity | Obstacles |

### Law 3: Conserve Alignment (from Axiom 3)

Check understanding before acting. Enable pushback. Make the invisible visible. Reverse direction when inertia builds.

| Catalog items | Role |
|---|---|
| Active Partner, Check Alignment, Reverse Direction, Context Markers, Feedback Flip, Reminders, Cast Wide, Coerce to Interface, Show-the-Agent, Mind Dump, Shared Canvas | Patterns |
| Silent Misalignment, Answer Injection, Tell Me a Lie, AI Slop | Anti-patterns |
| Compliance Bias, Black Box AI, Selective Hearing, Solution Fixation, Obedient Contractor | Obstacles |

---

## Three Composition Principles

How to build complex AI-augmented work from simple pieces.

**Compose in Time** — Chain small steps, create checkpoints, iterate with refinement loops, reset strategically. Each step verified before the next begins.

**Compose in Space** — Focused agents with single responsibilities, orchestrators for integration, background agents for parallel work. One agent, one job.

**Compose in Abstraction** — Semantic zoom for navigation, knowledge composition for modularity, ground rules for always-on context, reference docs for on-demand depth.

---

## The Functional Programming Parallel

The user question: what's the category-light parallel to AI patterns, the way FP is the clean alternative to OOP's coupled hierarchies?

| FP Concept | AI Equivalent | Why it maps |
|---|---|---|
| Pure functions | Focused agents | No side effects, single input→output, composable |
| Immutability | Statelessness | AI can't learn; conversation is the only state |
| Types | Constraints (hooks, interfaces, criteria) | Structure enforces what instructions can't |
| Composition | Chaining (small steps, pipelines) | Complex from simple, verified at each boundary |
| Referential transparency | **MISSING** — this is the fundamental problem | Same prompt ≠ same output |
| Monads (managing effects) | Verification gates | Wrapping non-deterministic operations with checkpoints |
| Lazy evaluation | JIT context loading | Only compute/load what's actually needed |
| Pattern matching | Session type detection | Route behavior by shape of input |

**FP exists because mutable state causes bugs. AI patterns exist because non-determinism causes drift.** FP's answer: immutability. AI's answer: **continuous verification** — not preventing non-determinism (impossible) but catching its consequences (feasible).

---

## The Value of NOT Acting

The most underexplored dimension. The field has an action bias: retrieve, generate, automate, implement. But:

**In a world where AI can act infinitely cheaply, the scarce resources are human attention and context window. NOT acting conserves both.**

### Act/Not-Act Decision Matrix

| Decision | Value of ACTING | Value of NOT ACTING |
|---|---|---|
| Retrieve vs Ask | Factual accuracy, verifiable | Forces human to articulate (clarifies own thinking), preserves context |
| Generate vs Curate | Speed, exploration | Quality, coherence, context conservation |
| Automate vs Manual | Consistency, scale | Judgment, learning, catching edge cases |
| Continue vs Reset | Preserves accumulated context | Fresh attention, no context rot |
| Implement vs Prototype | Tangible progress | Cheap exploration, prevents premature commitment |
| Fix vs Revert | Preserves "progress" | Clean slate, learning from failure |
| Full pipeline vs Skip | Rigor, completeness | Proportionality, respecting simplicity |

### When to Retrieve vs Ask

**Retrieve when:**
- The answer is factual and verifiable (API signatures, file contents, versions)
- The source is known and accessible
- Getting it wrong has high cost
- The user can't easily provide it

**Ask when:**
- The answer is subjective or preference-based
- The user knows but hasn't stated (intent, priorities, constraints)
- Getting it wrong is cheap to correct
- Asking would clarify the user's own thinking

**Decision rule:** Ask first when the question is about WHAT or WHY. Retrieve first when the question is about HOW or WHAT EXISTS.

---

## Near-Deterministic Behavior That Lasts

Seven principles for making AI behavior survive context decay:

1. **Hooks > Instructions** — Deeply trained behaviors beat prompts. Use lifecycle hooks to detect and correct deterministically.
2. **Interface > Instruction** — Make the wrong thing structurally impossible, not just discouraged.
3. **Small scope > Large scope** — One responsibility = reliable execution.
4. **Checkpoint > Continuation** — Preserve expensive work (plans, decisions), regenerate cheap work (code).
5. **Repetition > Once** — Say critical things 5 times, not once. Attention is finite and recent.
6. **Verification > Trust** — External feedback loops with measurable criteria.
7. **Strategic reset > Persistent continuation** — Reset before context rots, not after.

**The meta-principle:** The LLM "gets into details" and loses the big picture because attention is finite and recent context dominates. The solution is architecture, not instructions. Hooks fire every turn (reminders). Markers survive compaction (checkpoints). Criteria are boolean (interface enforcement). Behavior is encoded in the structure around the LLM, not in the instructions to it.

---

## moo.md Audit

### What moo.md Nails

**Alignment verification (Axiom 3)** — moo's strongest suit. The entire intent skill is a systematic "Check Alignment": five-dimension spec scoring, echo checks, adversarial questions, iron-clad briefs. The catalog has a single pattern for this. Moo has a full state machine.

**Statelessness as hard constraint** — "Conversation is the only state. No persistent files." The FP-immutability equivalent, enforced architecturally. The catalog never elevates this to a principle.

**Perspective diversity** — Consult with 42 curated profiles, coverage tiers (Documented → Inferred → Extrapolated → Refuse), panel debates with tension-surfacing. Grounded expert system with intellectual honesty about extrapolation limits.

**Pipeline as architecture** — intent→shape→loop is a state machine with hooks, back-transitions, circuit breakers, and deadlock prevention. Structure enforces behavior.

**Engagement adaptation** — Autonomous/Collaborative/Guided changes interaction density within every skill. A spectrum, not a binary.

**Investigation before implementation** — "Never combine find + fix in one task." Cognitive mode separation. Deeper than anything in the catalog.

**Machine-verifiable criteria** — "Criteria must be boolean. Ambiguity lets you fool yourself into done." Universal constraint, not just a testing technique.

### What moo.md Misses

**1. Context as scarce resource (Axiom 1) — the biggest gap**

No skill models context budgeting. Soul fires every turn (good for reminders, bad for context consumption). Shape outputs criteria + mustNot + verification approach — all persisting in context. No "noise cancellation" applied to moo itself. No mechanism to detect context rot within a session. Soul audits spec/fit/shape/verification but not "has this conversation been going too long?"

**2. Non-determinism as design material (Axiom 2)**

Moo verifies against non-determinism (loop verification gates, expert review) but doesn't exploit it:
- No parallel implementations (try 3 approaches, pick best). Loop is sequential.
- No disposability embrace. Loop invests heavily in each wave item.
- No deterministic/non-deterministic task classification within a wave.

When loop stalls, moo consults experts. The catalog would say: revert, reset, try 3 new things simultaneously.

**3. No conservation principle for acting vs not acting**

For a 2-line typo fix, soul still fires, session type is detected, engagement is asked. Proportionality exists within the pipeline (compressed footer for Type 2A/2B) but no decision to skip the pipeline entirely. No "is this even worth the pipeline?" gate.

**4. Feedback loops as first-class architecture**

Moo has expert review panels within loop. The catalog's "Feedback Loop" is more fundamental: give AI automated feedback (tests, linters) and permission to iterate without human gating. Moo's Autonomous engagement level points toward this but doesn't encode how to set up the feedback mechanism.

**5. Strategic reset**

Moo preserves state across compaction (correct — don't lose context accidentally). But never recommends a deliberate reset. The catalog identifies context rot as progressive (focus → effective → red zone) and recommends proactive resets. "Reset recommended" is not a soul audit outcome.

**6. Self-diagnostic canary**

When AI struggles to follow a moo skill, is that AI's fault or the skill's fault? No meta-audit tracking "how often does soul interrupt? how often does loop back-transition?" to surface skill design problems.

**7. Retrieve-vs-ask micro-decisions**

"Retrieved over recalled" is correct but incomplete. Handles "don't guess what you can look up" but not "don't look up what you should ask the human about." Intent covers this at macro level. Within loop, no guidance for when to pause and ask vs. go retrieve.

### Summary Scorecard

| Concept | Catalog | moo.md | Gap |
|---|---|---|---|
| Alignment verification | Good | **Excellent** | moo wins |
| Context conservation | **Excellent** | Partial | Missing budgeting, reset strategy |
| Non-determinism management | **Excellent** | Partial | Missing parallel attempts, disposability |
| Statelessness | Implicit | **Excellent** | moo wins |
| Perspective diversity | Light | **Excellent** | moo wins |
| Proportionality | Implicit | Partial | No pipeline-skip gate |
| Feedback automation | Good | Partial | Missing feedback loop setup |
| Self-diagnostic | Good (Canary) | Absent | Missing entirely |
| Act/not-act framework | Partial | Absent | Neither has this formalized |
| Composition theory | Scattered | Good | bond + wave execution |

---

## Toward a Complete Theory

```
AXIOMS (what's true about AI)
├── Context is finite and decaying
├── Output is non-deterministic
└── Alignment is invisible until tested

CONSERVATION LAWS (what to protect)
├── Conserve Context — only load what's needed, extract before reset
├── Conserve Certainty — verify, checkpoint, revert freely
└── Conserve Alignment — check before acting, enable pushback

COMPOSITION (how to build)
├── In Time — chain, checkpoint, reset strategically
├── In Space — focused agents, orchestrators, parallel attempts
└── In Abstraction — semantic zoom, knowledge composition, ground rules

DECISION FRAMEWORK (when to act vs not)
├── Retrieve when factual + verifiable + high-cost-if-wrong
├── Ask when subjective + clarifying + cheap-to-correct
├── Generate when exploring + disposable + parallel-safe
├── Curate when converging + context-scarce + quality-critical
├── Continue when context fresh + approach converging
└── Reset when context rotting + approach diverging

ENFORCEMENT (how to make it last)
├── Hooks > Instructions (deterministic correction)
├── Interfaces > Instructions (structural impossibility)
├── Repetition > Once (attention is finite)
├── Architecture > Prompts (survive context rot)
└── Verification > Trust (external feedback loops)
```

The catalog covers axioms implicitly and composition tactics well. Moo covers composition, decision framework partially, and enforcement. **Neither has the full stack.** The act/not-act decision framework is the most novel and underexplored layer.

---

## Sources

- [Augmented Coding Patterns Catalog](https://lexler.github.io/augmented-coding-patterns/pattern-catalog/)
- [GitHub: lexler/augmented-coding-patterns](https://github.com/lexler/augmented-coding-patterns)
- [moo.md hope plugin](https://github.com/saadshahd/moo.md)
