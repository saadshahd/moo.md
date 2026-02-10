---
name: shape
description: Bridge WHAT (intent) to HOW (implementation). Use when spec is clear but approach is not. Triggers on "shape this", "how should I build", "implementation approach".
model: opus
---

# Shape

DECIDE. Bridge between intent clarification and implementation. Transforms WHAT into HOW.

## Entry

Requires spec_score >= 5 (otherwise return to intent). Output: shape + criteria[] + mustNot[] in conversation. Never writes files.

---

## Protocol

### 1. Extract Intent

From user request or prior `/hope:intent`, extract: goal, constraints, scope, feasibility axis + bound.

Also scan for context slots: `PATTERNS:` (existing conventions/precedent), `BOUNDARIES:` (architectural constraints, team norms), and `FEASIBLE:` (constraint axis + bound from intent or session default). When present, use as evidence when scoring Novelty and Risk aspects.

When PATTERNS slot is empty, retrieve existing conventions — search codebase (grep/glob) and current docs/standards (WebSearch/WebFetch) before scoring Novelty. When FEASIBLE axis is `tools`, read the project's dependency manifest before filtering approaches.

### 2. Identify Candidate Shapes

Three collaboration modes determine how user and agent interact during implementation:

| Shape           | Interaction                                    | Best When                                            |
| --------------- | ---------------------------------------------- | ---------------------------------------------------- |
| **Colleague**   | Iterate every step together                    | High ambiguity, novel domain, irreversible decisions |
| **Tool-Review** | Autonomous with checkpoints at major decisions | Moderate complexity, known patterns with unknowns    |
| **Tool**        | Fully autonomous, milestone announcements only | Clear requirements, well-trodden patterns, low risk  |

### 3. Score Aspects

For each aspect in the discovery table below, determine which shape column the task falls into.

For Novelty: retrieve before scoring — search codebase for existing patterns AND search online for current approaches. "No precedent" requires search evidence, not absence of recall.

### 4. Expert Consultation (+ Approach Comparison)

Guided: emit [TALLY] block. Expert consultation only when: (a) 2+ aspects disagree by 2+ columns, OR (b) any aspect scores Colleague in Risk. Re-score contradicted aspects. Still competing → Tool-Review. Unanimous → skip.

When 2+ candidate approaches surface in extraction or scoring:

| ?            | [Aspect question A] | [Aspect question B] | [Aspect question C] | Notes (≤15w) |
| ------------ | ------------------- | ------------------- | ------------------- | ------------ |
| [Approach A] | [0-10]              | [0-10]              | [0-10]              |              |
| [Approach B] | [0-10]              | [0-10]              | [0-10]              |              |

**Spread:** ≥1 cell ≤3, ≥1 cell ≥8. Scale: 0=clearly no, 10=clearly yes
Columns: relevant aspects as questions where approaches diverge (>2pt gap). If spread fails, wrong columns.
User picks approach → continue aspect scoring with chosen approach.

### 5. Select Shape

Count which column each aspect lands in:

- **Majority Colleague** → Colleague shape
- **Majority Tool** → Tool shape
- **Mixed or majority Tool-Review** → Tool-Review shape
- **Override:** Any Colleague in Risk or Interdependency → at minimum Tool-Review
- **Default when uncertain:** Tool-Review

### 5b. Feasibility Filter

When a feasibility axis is active (from `FEASIBLE:` slot or session default), apply it AFTER shape selection to filter the approach:

| Axis       | Eliminate approaches that...                                                          |
| ---------- | ------------------------------------------------------------------------------------- |
| **Time**   | Require learning curves or multi-phase migrations exceeding the bound                 |
| **Solo**   | Require coordination, specialized roles, or multi-agent orchestration beyond one pass |
| **Cost**   | Require paid services or licensed tools                                               |
| **Tools**  | Require dependencies not in the project                                               |
| **Access** | Require permissions or environments the user lacks                                    |

For Tools and Access axes: read project files (manifests, configs) and check current docs (WebSearch) before eliminating. Never filter by recall alone.

If ALL candidate approaches eliminated: surface the conflict — `"Feasibility ([axis]) eliminates all shaped approaches. Recommend: relax [axis] or reduce scope."`

If feasibility is `none`: skip this step.

### 6. Output Shape

Present shape output satisfying ALL:
1. Table: Aspect | Column | Because (≤12w) | Would change if (≤15w) | Feasible: [axis] (≤10w, omit if none)
2. Because must cite a specific observable — file names, line counts, dependency chains, API shapes — not adjectives
3. Would-change-if must be a condition someone could CHECK tomorrow — "if auth moves to middleware (check router.ts)" not "if things change"
4. Tally columns, select majority, emit criteria[] (boolean) + mustNot[] (≥2) — user counter-evidence re-scores that aspect
5. Emit `Disposable: [yes/no]` — yes when both Novelty and Ambiguity score Colleague (prototype territory). Loop treats disposable work with less investment and faster iteration.

SELF-AUDIT (after shape output, revise before presenting if any FAIL) →
  All 5 aspects scored      → [pass/fail] → scored/deferred: [names]
  Each has Because           → [pass/fail] → [count with / total]
  Each has Would-change-if   → [pass/fail] → [count with / total]
  criteria[] non-empty       → [pass/fail] → [count items]
  mustNot[] has ≥2 items     → [pass/fail] → [cite items]
  Shape selected + justified → [pass/fail] → [cite majority column]
  Approach grid spread met (≥1 ≤3, ≥1 ≥8) or single approach → [pass/fail]
  Because cites retrieved observable (not recalled) → [pass/fail] → [count verified / total]

### 7. Action Bridge

After shape output, append: `→ Start: [first atomic action from highest-priority criterion ≤15w — produces visible artifact]`
Colleague → action is a question to ask. Tool-Review/Tool → action is a command or file to create.

### After Shape

Shape is locked. Validate approach before execution:
- Build / Debug / Plan: run Skill(skill="hope:consult", args="evaluate approach") with criteria[]/mustNot[] and selected shape
- After consult synthesis: Build / Debug → run Skill(skill="hope:loop") | Plan → present output

---

## Aspect Discovery

Score each aspect for the task. The column where most aspects land determines the shape.

| Aspect          | Colleague                           | Tool-Review                         | Tool                          |
| --------------- | ----------------------------------- | ----------------------------------- | ----------------------------- |
| Interdependency | High coupling across unknowns       | Moderate, checkpoints at boundaries | Low, independent pieces       |
| Novelty         | No precedent, unknown patterns      | Known patterns with variations      | Well-trodden, clear precedent |
| Risk            | High blast radius, irreversible     | Medium, partially reversible        | Low, fully reversible         |
| Ambiguity       | Requirements unclear or conflicting | Mostly clear, few open questions    | Crisp, complete requirements  |
| Reversibility   | Hard to undo, high stakes           | Moderate rollback effort            | Trivial to revert             |

**Rule:** Score all 5. **Horizon tiebreaker** (columns split evenly): Tactical → Ambiguity decides | Strategic → Risk + Reversibility decide | Existential → Novelty + Interdependency decide.

---

## Integration

1. Ground decisions in session values
2. Run this skill's protocol (steps 1-7)
3. Output shape choice + approach + risks in conversation

Shape output feeds into the execution loop:

| Shape Output | Loop Usage                 |
| ------------ | -------------------------- |
| `criteria`   | Verification tracking      |
| `mustNot`    | Circuit breaker triggers   |
| `shape`      | Interaction mode for waves |

---

## Boundary

Shape surfaces considerations; user owns architecture.

- Expert recommendations are patterns, not prescriptions
- User resolves conflicts
- Shape informs design decisions, never makes them
