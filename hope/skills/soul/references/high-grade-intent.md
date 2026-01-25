# High-Grade Intent

Spec format that prevents drift. Every section reduces ambiguity.

## Template

### A) OBJECTIVE

1-2 sentences. The outcome, not the activity.

```
[Verb] [specific deliverable] so that [measurable result].
```

### B) NON-GOALS

3-5 bullets. Explicit "does NOT" statements.

- Does NOT include [feature/scope]
- Does NOT replace [existing system]
- Does NOT need to handle [edge case]
- Does NOT require [optional capability]
- Does NOT optimize for [non-priority metric]

### C) INPUTS

Exact sources with examples.

| Input | Source | Example |
|-------|--------|---------|
| [data type] | [location/API] | [sample value] |

### D) CONSTRAINTS

- **Style:** [voice, tone, formatting rules]
- **Format:** [file type, structure, length limits]
- **Tools:** [permitted/required technologies]
- **Privacy:** [PII handling, data retention]
- **Performance:** [latency, resource limits]

### E) ACCEPTANCE CRITERIA

7-12 bullets. At least 2 "must NOT" items.

- [ ] Must [positive requirement]
- [ ] Must [positive requirement]
- [ ] Must NOT [negative requirement]
- [ ] Must NOT [negative requirement]
- [ ] When [condition], then [behavior]

### F) AMBIGUITY LIST

3-7 bullets. Things that could be misunderstood.

- "[Term]" means [specific definition], not [common assumption]
- If [unclear situation], prefer [choice A] over [choice B]
- [Assumption] may be wrong; verify with [check]

### G) STOP CONDITIONS

3-5 bullets. "Stop and ask if..."

- Stop if [unexpected state] encountered
- Stop if [resource threshold] exceeded
- Stop if [assumption] proves false
- Stop if [scope boundary] approached
- Stop if [ambiguous requirement] blocks progress

## Quality Check

| Section | Passes If |
|---------|-----------|
| Objective | One sentence, measurable |
| Non-Goals | 3+ explicit exclusions |
| Inputs | All sources accessible |
| Constraints | No implicit rules |
| Acceptance | 2+ "must NOT" items |
| Ambiguity | Jargon defined |
| Stop Conditions | No heroics encouraged |

## Common Gaps

- Missing non-goals → scope creep
- No "must NOT" → unsafe defaults
- No stop conditions → silent failures
- Vague inputs → wrong data used
