# SHAPE.md Template

Full template for shape output document.

## File Location

`.loop/shape/SHAPE.md`

## Template

```markdown
# Shape: [Task Name]

Generated: [timestamp]
Spec Score: [X/10]
Fit Score: [Y/50]

---

## Summary

[1-2 sentence description of what's being built and primary approach]

---

## Relevant Aspects

| Aspect | Evidence | Priority |
|--------|----------|----------|
| [Aspect] | "[keyword from spec]" | P0/P1/P2 |

---

## Implementation Criteria

Machine-verifiable conditions that must be true when complete:

```yaml
criteria:
  - "[Criterion 1]: [Boolean condition]"
  - "[Criterion 2]: [Specific measurable outcome]"
  - "[Criterion 3]: [Testable state]"
```

### Criteria Details

| Criterion | Verification Type | Command/Method |
|-----------|------------------|----------------|
| [Criterion 1] | execution output | `npm test -- --grep "feature"` |
| [Criterion 2] | observation | Load page, see component |
| [Criterion 3] | measurement | `curl -w "%{time_total}"` < 0.1s |

---

## Must-NOT Constraints

Things to actively avoid:

```yaml
mustNot:
  - "[Constraint 1]: [Anti-pattern to prevent]"
  - "[Constraint 2]: [Boundary not to cross]"
  - "[Constraint 3]: [Risk to mitigate]"
```

### Why These Constraints

| Constraint | Rationale | Consequence if Violated |
|------------|-----------|------------------------|
| [Constraint 1] | [Expert guidance] | [What breaks] |

---

## Expert Decisions

### Consulted Experts

| Aspect | Expert | Question Asked | Recommendation |
|--------|--------|----------------|----------------|
| [Aspect] | [Name] | "[Question]" | [Answer] |

### Conflicts Resolved

**Conflict:** [Expert A] suggests X, [Expert B] suggests Y.

**Resolution:** Applied [Hickey/Fowler/tie-breaker] hierarchy.

**Reasoning:** [Why this choice aligns with simplicity/pragmatism/fewer-deps]

---

## Architecture Notes

### Data Flow

```
[Source] → [Transform] → [Destination]
```

### Key Interfaces

| Interface | Type | Contract |
|-----------|------|----------|
| [Name] | [API/Function/Event] | [Signature or schema] |

### Dependencies

| Dependency | Version | Why Needed |
|------------|---------|------------|
| [Package] | [^X.Y] | [Purpose] |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| [Risk] | Low/Med/High | Low/Med/High | [Action] |

---

## Loop Integration

### criteriaStatus Mapping

```json
{
  "[Criterion 1]": {"met": false, "verification": "execution output"},
  "[Criterion 2]": {"met": false, "verification": "observation"},
  "[Criterion 3]": {"met": false, "verification": "measurement"}
}
```

### Circuit Breaker Triggers

If any `mustNot` condition becomes true → pause loop immediately.

### Exit Gate

`exit_signal: true` only when:
1. All `criteriaStatus.met` = true
2. No `verification: "assumption"` remains
3. No `mustNot` condition is true

---

## Confidence

| Dimension | Score | Notes |
|-----------|-------|-------|
| Spec clarity | /10 | |
| Expert consensus | High/Med/Low | |
| Risk level | Type 2A/2B/1 | |
| Overall | ~X% | |
```

---

## Usage Notes

- **Required sections:** Criteria, Must-NOT, Expert Decisions
- **Optional sections:** Architecture Notes, Risk Assessment (for complex tasks)
- **Always include:** Verification types for all criteria
- **Update on change:** If spec changes during loop, regenerate SHAPE.md
