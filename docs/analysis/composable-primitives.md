# Composable Primitives: Type Contracts for AI Skills

Design vocabulary for building composable skills in Claude Code. Derived from the [AI patterns framework](ai-patterns-framework.md), category theory, and functional programming parallels.

---

## Why Type Contracts (Not Sub-Skills)

Runtime skill composition in Claude Code is expensive: each `Skill()` invocation loads ~500-800 tokens of SKILL.md content. Chaining 6 small primitive-skills costs more context than one well-structured skill.

The composition is at **design time, not runtime.** Primitives are type contracts — standardized input/output patterns that skills implement. Like Haskell typeclasses, not function calls. A skill declares which contracts it implements. Skills following the same contracts compose predictably.

---

## Three Laws of Human-AI Collaboration

The algebra that governs primitive behavior.

**Law 1: Conservation of Understanding.** Every AI action that replaces human reasoning must be compensated by explicit knowledge extraction, or understanding degrades over time.

**Law 2: Confidence is monotonically bounded.** The further from verified ground truth, the lower the maximum achievable confidence. No amount of prompting makes an LLM more reliable on out-of-distribution tasks.

**Law 3: Context is thermodynamic.** Context windows have entropy. Every token added increases disorder unless actively managed. Compaction, extraction, and zoom are cooling operations.

---

## Six Primitive Contracts

### Gate

```
Reads: context + threshold
Does:  Decides — should we act?
Emits: [GATE] decision + confidence + basis
```

Patterns: confidence check, preservation check, scope check, spec scoring, coverage assessment.

Gate enforces Law 2 (confidence bounded by distance from ground truth) and the axiological layer (what SHOULD we do?).

FP parallel: Smart Constructor — don't construct (execute) unless valid.

### Transform

```
Reads: input markers + context
Does:  Produces new output from input
Emits: [OUTPUT] result markers
```

Patterns: intent clarification, code generation, expert simulation, wave execution.

Transform is the procedural core — the work itself.

FP parallel: Higher-Order Function — behavior passed as data.

### Verify

```
Reads: output + expectations (criteria[])
Does:  Checks output against expectations
Emits: [VERIFY] pass/fail per criterion + evidence
```

Patterns: echo check, test execution, expert review, self-audit.

Verify enforces Law 2 (external feedback bounds confidence) and the epistemological layer (what can we KNOW?).

FP parallel: Reactive Stream — output triggers verification triggers correction.

### Extract

```
Reads: conversation context
Does:  Distills reusable knowledge
Emits: [EXTRACT] checkpoint markers
```

Patterns: brief emission, wave report, understanding extraction, compaction.

Extract enforces Law 1 (compensate AI action with knowledge extraction) and Law 3 (reduce entropy through distillation).

FP parallel: ADT + fold — state as data, fold to checkpoint.

### Zoom

```
Reads: abstraction level + context
Does:  Changes what we're looking at
Emits: [ZOOM] focused context
```

Patterns: session type detection, aspect discovery, semantic navigation.

Zoom enforces Law 3 (cooling operation — reduce context to what matters at this level).

FP parallel: Function Composition — compose context incrementally.

### Compose

```
Reads: primitive sequence + failure handling
Does:  Chains primitives, handles retry/fallback
Emits: [COMPOSE] pipeline state
```

Patterns: pipeline orchestration, feedback loops, wave iteration.

Compose is the tagless final — define the skeleton, swap the interpreters.

FP parallel: Template Method via Tagless Final.

---

## Category Theory Alignment

| Level | Category Theory | AI Primitives | Examples |
|-------|----------------|---------------|----------|
| 3: Algebra | Laws | Three Laws of Human-AI Collaboration | Confidence bounded, context thermodynamic, understanding conserved |
| 2: Functors | Transformations between domains | Six primitive contracts | Gate, Transform, Verify, Extract, Zoom, Compose |
| 1: Natural Transformations | Specific techniques | Skill implementations | Spec scoring, wave execution, expert simulation |

---

## Ontological Alignment

| Layer | Question | Primitives | Skill examples |
|-------|----------|-----------|----------------|
| Ontological (what IS?) | What are we working with? | Zoom | Session type detection, aspect discovery |
| Epistemological (what can we KNOW?) | How confident are we? | Gate, Verify | Coverage tiers, verification gates |
| Procedural (how do we CONTROL?) | What transforms do we apply? | Transform, Compose | Wave execution, pipeline orchestration |
| Axiological (what SHOULD we do?) | Should we act at all? | Gate(preserve), Extract | Preservation check, understanding extraction |

---

## FP → AI Pattern Map

| OOP Pattern | FP Equivalent | AI Primitive | Mapping |
|-------------|--------------|-------------|---------|
| Factory | Smart Constructor | Gate | Don't execute unless valid |
| Strategy | Higher-Order Function | Transform | Behavior passed as data |
| Observer | Reactive Stream | Verify | Output triggers correction |
| Decorator | Function Composition | Zoom | Compose context incrementally |
| State Machine | ADT + fold | Extract | State as data, fold to checkpoint |
| Template Method | Tagless Final | Compose | Define skeleton, swap interpreters |

Every pattern in the augmented-coding-patterns catalog is a specific composition of these 6 primitives:
- Feedback Loop = Transform → Verify → Transform
- Confidence Gate = Gate → Transform
- Orchestrator = Compose(Gate → Transform → Verify → Extract)

---

## How Existing Skills Map

| Skill | Primitive composition (design time) |
|-------|-------------------------------------|
| soul | Gate(audit) → Zoom(session_type) |
| intent | Gate(spec_score) → Transform(clarify) → Verify(echo_check) → Extract(brief) |
| shape | Zoom(aspects) → Gate(score) → Transform(select) → Verify(self-audit) → Extract(criteria) |
| loop | Gate(spec) → Compose(Transform(wave) → Verify(gate) → Extract(report)) × N |
| consult | Zoom(domain) → Gate(coverage) → Transform(simulate) → Verify(grounding) |
| bond | Gate(fitness) → Transform(design) → Verify(user_approval) → Extract(blueprint) |

---

## New Capabilities Enabled

These compose from the primitive vocabulary:

**Preservation Gate** — Gate(preserve): "Would doing this manually teach something? Is AI confidence > mine?" Serves Law 1.

**Feedback Loop** — Transform → Verify → Extract(failure_reason) → Transform(with_feedback). Currently tested in loop Step 4: carry items include `[VERIFY] FAIL: [reason]` in retry spawn prompt. Serves Law 2.

**Disposability Signal** — Gate(disposability) at shape output. Both Novelty and Ambiguity score Colleague → prototype territory. Loop treats disposable work with ≤ 3 items, expects to discard. Serves Law 3.

**Understanding Extraction** — Extract(understanding) in wave reports. `[LEARN] What this wave revealed: [insight ≤15w]` — extracts domain learning, not just progress. Serves Law 1.

---

## Experiments

Four micro experiments validate the type contract vocabulary. Each tests one primitive in one existing skill.

| # | Name | Primitive | File | Change |
|---|------|-----------|------|--------|
| 1 | Feedback Loop | Verify → Compose(retry) | loop Step 4 | Carry items include failure reason in retry prompt |
| 2 | Disposability | Gate(disposable) | shape Step 6 + loop Step 3 | Disposable signal from aspect scores; loop limits items |
| 3 | Understanding Extraction | Extract(learn) | loop Step 4 | [LEARN] marker in wave reports |
| 4 | Retrieve-vs-Ask | Gate(micro-decision) | loop Step 4 spawn | WHAT/WHY → ask user, HOW/EXISTS → retrieve |

**Verification protocol per experiment:**
1. Baseline: 2-3 real tasks, observe current behavior
2. Implement: smallest possible change
3. Test: 3-5 real tasks, observe specific signal
4. Decide: positive → keep, neutral → investigate, negative → revert

**Meta-verification:** After all 4 — did the vocabulary make these features easier to design? Were the contracts useful as a design language?

---

## Sources

- [AI Patterns Framework](ai-patterns-framework.md) — axioms, conservation laws, gap analysis
- [Augmented Coding Patterns Catalog](https://lexler.github.io/augmented-coding-patterns/pattern-catalog/) — 43 patterns, 9 anti-patterns, 14 obstacles
- moo.md hope plugin — reference implementation
