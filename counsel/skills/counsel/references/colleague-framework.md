# Expert Deferral Framework

Decision rules when multiple experts provide conflicting guidance.

---

## When Experts Disagree

### Decision Tree

1. **Identify the domain** — Which expert's core domain does this question fall into?
2. **Check domain-specific trust** — Defer to the expert whose core competency matches the question
3. **If genuinely cross-domain** — Weight by confidence scores, flag the conflict

---

## Domain-Specific Trust

| Domain | Defer To | Rationale |
|--------|----------|-----------|
| API design, system boundaries | Systems thinker | Architectural decisions are their wheelhouse |
| Ergonomics, user experience | Designer | User-facing concerns are their core competency |
| Performance, runtime behavior | Performance engineer | Measurement and optimization are their domain |
| Code clarity, maintainability | Refactoring advocate | Long-term code health is their focus |
| Shipping speed, pragmatism | Convention advocate | They've shipped; they know the tradeoffs |

---

## Trust Ladder

Guidance lifecycle based on domain confidence:

| Confidence | Treatment | Action |
|------------|-----------|--------|
| **High** (8-9/10) | Follow closely | Expert's core domain, documented positions |
| **Medium** (6-7/10) | Consider strongly | Adjacent domain, consistent with their philosophy |
| **Low** (3-5/10) | Directional only | Outside documented expertise, speculation |

---

## Conflict Resolution Protocol

When 3+ experts disagree:

### Step 1: Domain Classification

Map the question to primary domain. Use that expert's guidance as the default.

### Step 2: Check for Meta-Agreement

Often experts disagree on tactics but agree on principles. Extract the shared principle.

### Step 3: Flag Genuine Conflicts

If principles conflict, present as:

```
**Conflict detected:**

- [Descriptor A]: [Position] (domain: X, confidence: Y/10)
- [Descriptor B]: [Position] (domain: X, confidence: Y/10)

**Resolution path:** [Domain expert] has primary authority here because [rationale].
Consider [other expert]'s concern as a constraint, not a veto.
```

### Step 4: User Decision

If conflict cannot be resolved by domain authority, present the tradeoff and let the user decide.

---

## Anti-Patterns

- **Averaging positions** — Consensus of experts often produces mediocrity
- **Loudest voice wins** — More documented work ≠ more relevant to this question
- **Ignoring domain mismatch** — A CSS expert's opinion on database design is directional at best

---

## Panel Facilitation Rules

When running a panel with potential conflict:

1. Present each perspective separately first
2. Identify areas of agreement
3. Isolate genuine disagreements
4. Apply domain-specific trust to resolve
5. Present unresolvable conflicts as user decisions
