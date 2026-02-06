---
name: shape
description: Bridge WHAT (intent) to HOW (implementation). Use when spec is clear but approach is not. Triggers on "shape this", "how should I build", "implementation approach".
model: opus
allowed-tools: Read, Bash
hooks:
  Stop:
    - hooks:
        - type: prompt
          prompt: "If this shape session made architectural decisions or identified constraints, return {\"ok\": false, \"reason\": \"Consider running /hope:learn to capture these design decisions.\"}. If just exploration, return {\"ok\": true}."
---

# Shape

Bridge between intent clarification and implementation. Transforms WHAT into HOW.

## When to Use Shape

- After `/hope:intent` when spec_score >= 5
- Explicit request: "shape this", "how should I build this"
- Architecture decisions needed before coding
- Invoked by `/loop:start` with LOOP_BRIDGE_ENABLED=true (Phase 2: plan mode bridge)

**If spec_score < 5:** Return to `/hope:intent` for clarification first.

### Loop Bridge Mode (Phase 2)

If LOOP_BRIDGE_ENABLED environment variable is set:
1. Write `.loop/shape/SHAPE.md` with shape, criteria, mustNot (as normal)
2. **Skip EnterPlanMode** — return control to loop:start for Step 2.5 (approval gate)
3. Loop will pause and ask user to approve plan before proceeding

If LOOP_BRIDGE_ENABLED is not set:
- Proceed as standalone skill (may invoke EnterPlanMode for complex decisions)

---

## Protocol

### 1. Extract Intent

From user request or prior `/hope:intent`, extract: goal, constraints, scope.

### 2. Identify Candidate Shapes

Three collaboration modes determine how user and agent interact during implementation:

| Shape | Interaction | Best When |
|-------|-------------|-----------|
| **Colleague** | Iterate every step together | High ambiguity, novel domain, irreversible decisions |
| **Tool-Review** | Autonomous with checkpoints at major decisions | Moderate complexity, known patterns with unknowns |
| **Tool** | Fully autonomous, milestone announcements only | Clear requirements, well-trodden patterns, low risk |

### 3. Score Aspects

For each aspect in the discovery table below, determine which shape column the task falls into.

### 4. Select Shape

Count which column each aspect lands in:

- **Majority Colleague** → Colleague shape
- **Majority Tool** → Tool shape
- **Mixed or majority Tool-Review** → Tool-Review shape
- **Override:** Any Colleague in Risk or Interdependency → at minimum Tool-Review
- **Default when uncertain:** Tool-Review

### 5. Emit SHAPE.md

Write `.loop/shape/SHAPE.md` with: selected shape, relevant aspects with evidence, criteria (boolean/verifiable), mustNot constraints.

---

## Aspect Discovery

Score each aspect for the task. The column where most aspects land determines the shape.

| Aspect | Colleague | Tool-Review | Tool |
|--------|-----------|-------------|------|
| Decomposition | Cannot break down without user | Breaks down, user validates | Self-decomposes fully |
| Interdependency | High coupling across unknowns | Moderate, checkpoints at boundaries | Low, independent pieces |
| Novelty | No precedent, unknown patterns | Known patterns with variations | Well-trodden, clear precedent |
| Risk | High blast radius, irreversible | Medium, partially reversible | Low, fully reversible |
| Ambiguity | Requirements unclear or conflicting | Mostly clear, few open questions | Crisp, complete requirements |
| Domain knowledge | Needs user context to proceed | Partial context, can infer rest | Full context available |
| Verification | User must define pass/fail | User approves test plan | Self-verifiable criteria |
| Reversibility | Hard to undo, high stakes | Moderate rollback effort | Trivial to revert |

**Rule:** Only score aspects that appear in the spec or have clear dependencies. Skip irrelevant rows.

---

## Expert Consultation

For each relevant implementation dimension, consult the anchor expert:

| Dimension | Expert | Core Question |
|-----------|--------|---------------|
| Data | Rich Hickey | "Is this genuinely simple, or just familiar?" |
| API | Martin Fowler | "Can I change this later without a rewrite?" |
| UI | Don Norman | "What does this afford?" |
| Auth | OWASP | "What's the blast radius if this fails?" |
| Performance | Brendan Gregg | "Where is the actual bottleneck?" |
| Error | Michael Nygard | "What happens when this fails?" |
| Testing | Kent Beck | "Am I testing behavior or implementation?" |
| Migration | Sam Newman | "Can we do this incrementally?" |
| Integration | Gregor Hohpe | "What if delivered twice?" |
| Deployment | Jez Humble | "Can we roll this back in minutes?" |

**Conflict hierarchy:** Hickey (simplicity) → Fowler (pragmatism) → option with fewer dependencies.

Document which experts disagreed and why one was chosen.

---

## Decision Logic

digraph shape_decision {
  rankdir=TB
  node [shape=box style="rounded,filled" fillcolor="#f5f5f5"]

  start [label="Spec ready\n(score >= 5)" fillcolor="#e6f3ff"]
  score [label="Score 8 aspects\nagainst 3 shapes" fillcolor="#ffe6cc"]
  decide [label="Majority column?" shape=diamond fillcolor="#fff4cc"]
  override [label="Risk or Interdep\n= Colleague?" shape=diamond fillcolor="#fff4cc"]
  colleague [label="Colleague shape" fillcolor="#ccffcc"]
  tool_review [label="Tool-Review shape" fillcolor="#ccffcc"]
  tool [label="Tool shape" fillcolor="#ccffcc"]

  start -> score -> decide
  decide -> colleague [label="Colleague"]
  decide -> tool_review [label="Mixed/Tool-Review"]
  decide -> override [label="Tool"]
  override -> tool_review [label="Yes" style=dashed]
  override -> tool [label="No"]
}

---

## Integration

1. Invoke `/hope:soul` to ground decisions in user values
2. Run this skill's protocol (steps 1-5)
3. Write `.loop/shape/SHAPE.md`
4. Invoke `/hope:verify` to lock criteria: `Skill(skill="hope:verify", args="lock criteria from shape")`

SHAPE.md feeds into `/loop:start`:

| SHAPE Field | Loop Usage |
|-------------|------------|
| `criteria:` | `criteriaStatus` tracking |
| `mustNot:` | Circuit breaker triggers |
| `shape:` | Interaction mode for waves |

---

## Boundary

Shape surfaces considerations; user owns architecture.

- Expert recommendations are patterns, not prescriptions
- User resolves conflicts — hierarchy is a tiebreaker, not authority
- Shape informs design decisions, never makes them
