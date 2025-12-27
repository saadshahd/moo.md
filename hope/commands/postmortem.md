---
description: Conduct structured post-incident review. Identifies root cause, contributing factors, prevention measures. Blameless and action-oriented.
---

# /postmortem

Run a structured post-incident review. Learn from failure without blame.

## Phase 1: Incident Summary

Capture the facts:
- What happened? (observable facts only)
- When did it happen? (timeline)
- Who was affected? (users, systems, team)
- What was the impact? (quantify if possible)
- How was it detected?
- How long until resolution?

## Phase 2: Timeline Construction

Build a detailed timeline:

```
## Timeline

**[Time] - Before Incident**
- [Relevant context/changes]

**[Time] - Incident Begins**
- [First symptom]
- [Detection method]

**[Time] - Response**
- [Action taken]
- [Result]

**[Time] - Resolution**
- [What fixed it]
- [Confirmation method]

**[Time] - After**
- [Follow-up actions]
```

## Phase 3: Root Cause Analysis (5 Whys)

Start with the symptom and drill down:

```
## 5 Whys

**Symptom:** [What users/systems experienced]

1. Why did this happen?
   → [Immediate cause]

2. Why did [immediate cause] happen?
   → [Contributing factor]

3. Why did [contributing factor] exist?
   → [Systemic issue]

4. Why did [systemic issue] persist?
   → [Process gap]

5. Why did [process gap] exist?
   → [Root cause]
```

**Root cause definition:** The deepest organizational/technical issue that, if fixed, prevents this entire class of incidents.

## Phase 4: Contributing Factors

Identify what made this possible (blameless):

### Technical Factors
- Missing monitoring/alerts
- Inadequate testing
- Insufficient redundancy
- Configuration issues
- Dependency failures

### Process Factors
- Missing runbooks
- Unclear ownership
- Insufficient review
- Deployment process gaps
- Communication breakdowns

### Human Factors
- Knowledge gaps (training opportunity)
- Assumptions (made in good faith)
- Time pressure
- Unclear priorities
- Insufficient context

## Phase 5: Prevention Measures

For each factor, propose prevention:

```
## Prevention Plan

### Immediate (< 1 week)
- [ ] [Action]: [Prevents recurrence] - Owner: [who] - Story points: X
- [ ] [Action]: [Reduces impact] - Owner: [who] - Story points: X

### Short-term (< 1 month)
- [ ] [Action]: [Systemic fix] - Owner: [who] - Story points: X
- [ ] [Action]: [Process improvement] - Owner: [who] - Story points: X

### Long-term (< 3 months)
- [ ] [Action]: [Architectural change] - Owner: [who] - Story points: X
- [ ] [Action]: [Organizational change] - Owner: [who] - Story points: X
```

**Test:** Would these measures prevent similar incidents in adjacent systems?

## Phase 6: Learnings Extraction

What did we learn?

### Surprises
- What behaved differently than expected?
- What assumptions were violated?
- What didn't we know we didn't know?

### System Knowledge
- What did we learn about how the system actually works?
- What mental models were wrong?
- What documentation is missing?

### Process Gaps
- What should have caught this earlier?
- What would have reduced impact?
- What slowed resolution?

## Phase 7: Synthesis

```
## Postmortem Summary

### Incident
[One sentence: what happened and impact]

### Root Cause
[The deepest systemic issue]

### Contributing Factors
1. [Technical factor]
2. [Process factor]
3. [Human factor]

### Prevention Measures (prioritized)
1. **[Immediate action]** - [Prevents recurrence] - X pts
2. **[Short-term fix]** - [Systemic improvement] - X pts
3. **[Long-term change]** - [Prevents class of issues] - X pts

### Key Learnings
1. [Surprising discovery]
2. [System knowledge gained]
3. [Process improvement identified]

### Success Criteria
How will we know these measures worked?
- [Metric or signal]
- [Review timeline]

---
[Quality Footer - see ../skills/soul/references/quality-footer.md]
```

## Phase 8: Learning Persistence

Propose additions to `~/.claude/learnings/`:

```
failures.jsonl:
{
  "ts": "[timestamp]",
  "context": "[system/feature]",
  "failure": "[what happened]",
  "root_cause": "[deepest cause]",
  "prevention": "[primary measure]"
}

discoveries.jsonl:
{
  "ts": "[timestamp]",
  "context": "[system/feature]",
  "discovery": "[what we learned]",
  "confidence": "X-Y%",
  "applies_to": "[where else this matters]"
}
```

## Phase 9: Wait

**Do not implement prevention measures.** Present postmortem and wait for user to prioritize actions.

Remember: The goal is learning and prevention, never blame.

---

## Task

$ARGUMENTS
