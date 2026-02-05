# Review Mode

Logic for `/counsel:panel review wave {N}` and `thorough review` patterns.

---

## Light Review

Pattern: `review wave {N} changes for: {spec}`

```dot
digraph LightReview {
  rankdir=TB
  node [shape=box, style="rounded,filled", fillcolor="#f5f5f5"]

  Start [label="review wave N", fillcolor="#e6f3ff"]
  Parse [label="Parse wave +\nspec"]
  Identify [label="Identify aspects\ntouched"]
  Select [label="Select 2-3\nexperts"]
  Review [label="Quick review\n(~30s)"]
  Score [label="Score +\nfindings"]
  Done [label="Non-blocking\noutput", fillcolor="#ccffcc"]

  Start -> Parse -> Identify -> Select -> Review -> Score -> Done
}
```

### Output Format (Light)

```
## Wave {N} Review: {score}/10

**Reviewers:** [expert A descriptor] (X/10), [expert B descriptor] (Y/10)

### Findings

| Severity | Issue | Guidance |
|----------|-------|----------|
| SUGGESTION | Consider extracting validation | Move to utils/validation.ts |
| WARNING | Missing null check | Add `user?.email` guard |

### Summary
- Score: {score}/10
- Issues: {count} ({blockers} blockers, {warnings} warnings)

*Non-blocking review. Loop continues.*
```

---

## Thorough Review

Pattern: `thorough review for: {spec} with constraints: {mustNot}`

```dot
digraph ThoroughReview {
  rankdir=TB
  node [shape=box, style="rounded,filled", fillcolor="#f5f5f5"]

  Start [label="thorough review for: spec", fillcolor="#e6f3ff"]
  Parse [label="Parse spec +\nmustNot constraints"]
  LoadPanel [label="Load full panel\n(3-4 experts)"]
  ReviewAll [label="Review all\nchanges"]
  CheckConstraints [label="Check fixes vs\nmustNot"]
  InteractiveLoop [label="Interactive\nfindings loop", fillcolor="#ffe6cc"]
  Done [label="Summary", fillcolor="#ccffcc"]

  Start -> Parse -> LoadPanel -> ReviewAll -> CheckConstraints -> InteractiveLoop -> Done
}
```

### Interactive Findings Loop

```dot
digraph FindingsLoop {
  rankdir=LR
  node [shape=box, style="rounded,filled", fillcolor="#f5f5f5"]

  Finding [label="Finding\nI of N", fillcolor="#fff4cc"]
  Choice [label="User\naction", shape=diamond, fillcolor="#fff4cc"]
  Approve [label="[Approve]"]
  CreateTask [label="[Create task]"]
  Discuss [label="[Discuss]"]
  Skip [label="[Skip]"]
  More [label="I < N?", shape=diamond, fillcolor="#fff4cc"]
  Next [label="Finding\nI+1"]
  Summary [label="Summary", fillcolor="#ccffcc"]

  Finding -> Choice
  Choice -> Approve [label="approve"]
  Choice -> CreateTask [label="task"]
  Choice -> Discuss [label="discuss"]
  Choice -> Skip [label="skip"]
  Approve -> More
  CreateTask -> More
  Discuss -> Finding [style=dashed, label="input"]
  Skip -> More
  More -> Next [label="yes"]
  Next -> Finding
  More -> Summary [label="no"]
}
```

### Output Format (Thorough)

```
## Thorough Review

**Panel:** [expert A] (X/10), [expert B] (Y/10), [expert C] (Z/10)

### Finding 1 of {N}

+----- {BLOCKER|WARNING|SUGGESTION} -----+
| {Issue description}                      |
+------------------------------------------+
| **Guidance:** {Idiomatic fix approach}   |
| **Constraint check:** {OK | BLOCKED}     |
+------------------------------------------+

**If fix violates constraint:**
  -> Alternative: {Constraint-respecting approach}

[Approve] [Create task] [Discuss] [Skip]
```

---

## Severity Definitions

| Severity | Definition | Action |
|----------|------------|--------|
| **BLOCKER** | Must fix before ship | Auto-creates task if not approved |
| **WARNING** | Should fix | Requires acknowledgment |
| **SUGGESTION** | Optional improvement | Informational |

---

## Expert-to-Aspect Mapping

| Aspect | Light Review | Thorough Review |
|--------|--------------|-----------------|
| API Design | Fowler | Fowler, Fielding |
| State | Hickey | Hickey, Abramov |
| Testing | Beck | Beck, Freeman |
| Security | OWASP | OWASP, Pike |
| Performance | Gregg | Gregg, Osmani |
| UI/UX | Norman | Norman, Zhuo |
| Architecture | Martin | Martin, Evans, Vernon |

---

## Constraint-Aware Guidance

Before suggesting fixes, check against mustNot from SHAPE.md:

1. Load constraints from `.loop/shape/SHAPE.md`
2. For each suggested fix:
   - Evaluate if fix violates any mustNot
   - If violation: mark as "BLOCKED - violates: {constraint}"
   - Provide alternative that respects constraints
3. Include constraint check in output
