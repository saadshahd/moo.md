# Workflow Shape

Match delegation style to task characteristics.

## Two Patterns

### Tool-Shaped (CNC Program)

For spec clarity score ≥8. Fire and forget.

**Structure:**
1. Complete spec upfront (high-grade intent)
2. Milestones with evidence requirements
3. Approval gates at defined checkpoints
4. Handoff package at completion

**Characteristics:**
- Minimal mid-flight communication
- Clear success/failure criteria
- Evidence at each milestone
- Final deliverable matches spec

**Handoff Package:**
- Deliverable files
- Verification evidence
- Assumptions made
- Known limitations

### Colleague-Shaped (Machinist Loop)

For spec clarity score 5-7. Iterate to convergence.

**Structure:**
1. Initial direction (partial spec)
2. Iteration cycles (typically 3)
3. Convergence signal
4. Final polish

**Iteration Cycle:**
```
Draft → Review → Feedback → Adjust → Check convergence
```

**Convergence Signals:**
- Feedback shifts from "direction" to "polish"
- Changes shrink in scope each cycle
- No new requirements emerging
- Reviewer says "close enough"

## Approval Gate Policy

| Stakes | Tool-Shaped | Colleague-Shaped |
|--------|-------------|------------------|
| **High** (production, customer-facing) | Gate every milestone | Gate every iteration |
| **Medium** (internal, reversible) | Gate at completion only | Gate at convergence |
| **Low** (experimental, throwaway) | No gates | No gates |

## Shape Selection

| Signal | Tool-Shaped | Colleague-Shaped |
|--------|-------------|------------------|
| Spec completeness | Can write tests now | Direction only |
| Output variability | One right answer | Multiple valid outputs |
| Feedback style | Pass/fail | Subjective preference |
| Domain | Well-defined | Exploratory |

## Anti-Patterns

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Tool pattern on fuzzy task | Output misses mark entirely | Switch to colleague pattern |
| Colleague pattern on clear task | Excessive iterations, no progress | Write full spec, switch to tool |
| No convergence signal | Infinite refinement | Define "good enough" upfront |
| Gates without criteria | Blocked waiting for approval | Specify approval criteria |
