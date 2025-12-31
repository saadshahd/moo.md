# Gap Analysis Workflow

Identify weakness patterns across multiple evaluations to prioritize improvement focus.

## Input Required

Use Ask tool to gather:

1. **Number of evaluated documents** available
2. **For each document:**
   - Artifact type (decision doc, spec, exec update, etc.)
   - Dimension-by-dimension scores if available
   - Key feedback quotes
   - Evaluator (self, peer, manager, AI)

## Analysis Process

### Step 1: Collect Evidence

Ask user to paste scores and feedback for each evaluated artifact.

Format requested:

```
Artifact 1: [Type]
Scores: [Dimension]: X, [Dimension]: Y, ...
Key Feedback: "[Quote]"

Artifact 2: ...
```

### Step 2: Pattern Recognition

Analyze across all artifacts for:

**Recurring Low Scores:**

- Which dimensions consistently score below average?
- Is there a pattern across artifact types?

**Repeated Feedback Themes:**

- What language appears in multiple evaluations?
- Are the same issues flagged by different evaluators?

**Surface vs Deep Issues:**

| Surface Issues        | Deep Issues             |
| --------------------- | ----------------------- |
| Formatting, structure | Reasoning, judgment     |
| Word choice, length   | Prioritization, framing |
| Missing sections      | Missing insights        |
| Readability           | Strategic thinking      |

### Step 3: Prioritization

For each weakness pattern, assess:

1. **Frequency:** How often does this appear?
2. **Impact:** What's the cost when this weakness shows?
3. **Fixability:** How tractable is improvement?
4. **Leverage:** Would fixing this improve multiple dimensions?

Prioritize by: `Impact × Frequency × Fixability × Leverage`

### Step 4: Root Cause Diagnosis

For top 2-3 weaknesses, dig deeper:

- Is this a skill gap (don't know how)?
- Is this a habit gap (know but don't do)?
- Is this a feedback gap (do but don't check)?
- Is this a judgment gap (check but misinterpret)?

## Output Format

```
## Weakness Pattern Analysis

### Data Summary

| Artifact | Type | Overall | Lowest Dimension | Key Feedback |
|----------|------|---------|------------------|--------------|
| 1 | [Type] | X/5 | [Dim]: Y | "[Quote]" |
| 2 | ... | | | |

### Pattern 1: [Weakness Name]

**Evidence:**
- Artifact 1: [specific example]
- Artifact 3: [specific example]
- Artifact 5: [specific example]

**Classification:** Surface / Deep
**Root Cause:** Skill / Habit / Feedback / Judgment gap
**Impact:** [What happens when this weakness shows]

**Priority Score:** X/20
- Frequency: X/5
- Impact: X/5
- Fixability: X/5
- Leverage: X/5

### Pattern 2: [Weakness Name]
[Same structure]

### Pattern 3: [Weakness Name]
[Same structure]

---

## Recommended Focus

**Top Priority:** [Pattern with highest score]
- Why: [Justification]
- Practice approach: [Specific exercises]

**Secondary:** [Second highest]
- Why: [Justification]
- Practice approach: [Specific exercises]

## Practice Exercises

### For [Pattern 1]:

**Exercise 1:** [Name]
- Task: [What to do]
- Time: [X minutes]
- Success criteria: [How to know it's improved]

**Exercise 2:** [Name]
- Task: [What to do]
- Time: [X minutes]
- Success criteria: [How to know it's improved]

### For [Pattern 2]:
[Same structure]
```

## Rules

- Pattern recognition requires minimum 3 artifacts
- Don't offer encouragement—offer honest diagnosis
- Distinguish surface from deep issues (deep issues matter more)
- Root cause diagnosis guides practice approach
- Exercises must be specific and time-boxed
