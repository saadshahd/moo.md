# Diagnose Mode (Stuck)

Logic for `/counsel:panel stuck on [task]: [error]` pattern.

---

## Process

```dot
digraph DiagnoseMode {
  rankdir=TB
  node [shape=box, style="rounded,filled", fillcolor="#f5f5f5"]

  Start [label="stuck on [task]: [error]", fillcolor="#e6f3ff"]
  Parse [label="Parse task +\nerror + failed approach"]
  SelectExperts [label="Select 2-3 diagnostic\nexperts by domain"]
  LoadProfiles [label="Load profiles\n(lazy)"]
  Diagnose [label="Each expert\ndiagnoses issue"]
  Consensus [label="Build consensus\nrecommendation"]
  Format [label="Format output", fillcolor="#ffe6cc"]
  Done [label="Output + fallback", fillcolor="#ccffcc"]

  Start -> Parse -> SelectExperts -> LoadProfiles -> Diagnose -> Consensus -> Format -> Done
}
```

---

## Retry Loop (Loop Integration)

When loop applies recommendation and retries:

```dot
digraph DiagnoseRetry {
  rankdir=LR
  node [shape=box, style="rounded,filled", fillcolor="#f5f5f5"]

  Input [label="Stuck\n(attempt N)", fillcolor="#e6f3ff"]
  Diagnose [label="Panel\ndiagnoses"]
  Apply [label="Loop applies\nrecommendation"]
  Check [label="Result?", shape=diamond, fillcolor="#fff4cc"]
  Success [label="Done", fillcolor="#ccffcc"]
  SameErr [label="Same\nerror"]
  NewErr [label="New\nerror"]
  AttemptCheck [label="N >= 3?", shape=diamond, fillcolor="#fff4cc"]
  Escalate [label="Thorough\nreview", fillcolor="#ffcccc"]
  Retry [label="Retry\n(N+1)"]

  Input -> Diagnose -> Apply -> Check
  Check -> Success [label="fixed"]
  Check -> SameErr [label="same"]
  Check -> NewErr [label="new"]
  SameErr -> AttemptCheck
  NewErr -> AttemptCheck
  AttemptCheck -> Escalate [label="yes"]
  AttemptCheck -> Retry [label="no"]
  Retry -> Diagnose [style=dashed]
}
```

**Loop contract:**
- Attempt 1-2: Retry with different diagnostic angle
- Attempt 3+: Escalate to thorough review
- Same error twice: Select different experts
- New error: Fresh diagnosis with error history

---

## Output Format

```
## Stuck Analysis: [task]

**Error:** [error summary]
**Failed Approach:** [what was tried]

### Diagnosis

**[Expert A descriptor] (X/10):** [diagnosis from their philosophy]
**[Expert B descriptor] (Y/10):** [diagnosis from their philosophy]

### Recommendations

1. **[approach]** (confidence: X/10)
   - Expert A supports because: [reason]
   - Expert B adds: [reason]

2. **[alternative approach]** (confidence: Y/10)
   - Expert C suggests because: [reason]

### Consensus Recommendation

[Most agreed-upon approach with confidence level]

### If Still Stuck

[What to try if first recommendation fails — different angle, not same advice]
```

---

## Loop Integration

Loop invokes `counsel:panel stuck on...` when:
- Task fails verification (stuckCount >= 1)
- Same error occurs twice

Loop applies recommendation by:
1. Extracting consensus recommendation
2. Updating task approach based on diagnosis
3. Retrying with new approach
4. On 3rd failure: escalates to thorough review
