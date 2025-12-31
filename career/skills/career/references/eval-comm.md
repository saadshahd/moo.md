# Executive Communication Evaluation Workflow

Score executive communications against a rubric designed for busy decision-makers.

## Input Required

Use Ask tool to gather:

1. **The communication to evaluate:** Executive update, one-pager, email to leadership, status report
2. **Context (optional):** Audience, stakes, what prompted this communication

## Evaluation Rubric

Score each dimension 1-5:

### 1. Bottom Line Up Front (BLUF)

| Score | Criteria                                        |
| ----- | ----------------------------------------------- |
| 5     | Key message crystal clear in first sentence     |
| 4     | Key message in first paragraph, easy to find    |
| 3     | Key message present but buried                  |
| 2     | Key message implied, requires inference         |
| 1     | Reader must read entire doc to understand point |

### 2. Ask Clarity

| Score | Criteria                                             |
| ----- | ---------------------------------------------------- |
| 5     | Explicit, specific, actionable ask ("I need X by Y") |
| 4     | Clear ask with minor ambiguity                       |
| 3     | Ask present but requires interpretation              |
| 2     | Implied ask that reader must infer                   |
| 1     | No ask when one is needed, or unnecessary ask        |

**Note:** If no ask is needed, score based on whether the communication correctly omits one vs. includes an unnecessary ask.

### 3. Context Economy

| Score | Criteria                                               |
| ----- | ------------------------------------------------------ |
| 5     | Minimum context for comprehension, no over-explanation |
| 4     | Mostly lean with minor excess                          |
| 3     | Balanced but could be tighter                          |
| 2     | More context than update                               |
| 1     | All context, no actual update                          |

### 4. Risk/Blocker Surfacing

| Score | Criteria                                 |
| ----- | ---------------------------------------- |
| 5     | Risks explicit with proposed mitigations |
| 4     | Risks called out, mitigations implied    |
| 3     | Risks mentioned without mitigation path  |
| 2     | Risks minimized or buried                |
| 1     | Known risks not mentioned                |

**Note:** If genuinely no risks, score based on whether the "no risks" assessment is credible and explicit.

### 5. Scannability

| Score | Criteria                                |
| ----- | --------------------------------------- |
| 5     | Key info extractable in 30-second skim  |
| 4     | Good structure, minor scanning friction |
| 3     | Readable but requires full read         |
| 2     | Dense, difficult to scan                |
| 1     | Wall of text, hostile to quick reading  |

## Evaluation Process

### Step 1: Time-to-Comprehension Test

Before detailed scoring, assess:

- How long to understand the key message?
- How long to understand the ask (if any)?
- How long to understand the status?

### Step 2: Dimension Scoring

For each dimension:

1. Quote the exact passage that justifies the score
2. Explain the score in one sentence
3. Suggest one specific edit that would raise score by 1 point

### Step 3: BLUF Rewrite

Rewrite the opening paragraph optimized for BLUF.

## Output Format

```
## Executive Communication Evaluation

**Document:** [Brief identifier]
**Time-to-Comprehension:** ~X seconds/minutes

### Scores

| Dimension | Score | Justification |
|-----------|-------|---------------|
| BLUF | X/5 | [One sentence] |
| Ask Clarity | X/5 | [One sentence] |
| Context Economy | X/5 | [One sentence] |
| Risk Surfacing | X/5 | [One sentence] |
| Scannability | X/5 | [One sentence] |
| **Total** | X/25 | |

### Detailed Feedback

**BLUF (X/5)**
> "[Quoted passage that demonstrates score]"

Edit to raise score: [Specific suggestion]

**Ask Clarity (X/5)**
> "[Quoted passage]"

Edit to raise score: [Specific suggestion]

**Context Economy (X/5)**
> "[Quoted passage]"

Edit to raise score: [Specific suggestion]

**Risk Surfacing (X/5)**
> "[Quoted passage]"

Edit to raise score: [Specific suggestion]

**Scannability (X/5)**
> "[Structural observation]"

Edit to raise score: [Specific suggestion]

### Rewritten Opening (BLUF-Optimized)

[Rewritten first paragraph that achieves 5/5 on BLUF]

### Summary

**Strongest dimension:** [Which one and why]
**Priority fix:** [Which dimension to focus on and specific action]
```

## Rules

- Quote exact passages—vague feedback is useless
- Edits must be specific enough to implement immediately
- BLUF rewrite should be usable, not theoretical
- Don't soften scores for politeness
- Time-to-comprehension is the ultimate test
