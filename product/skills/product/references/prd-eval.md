# PRD Evaluation

Evaluate a Product Requirements Document for completeness and actionability.

## Input

Ask for:

- PRD to evaluate (paste or file path)
- Context (team size, timeline, system criticality)

## Evaluation Dimensions

Score each 0-5:

### 1. Completeness

Are all critical sections present and detailed?

- 5: Problem, user stories, acceptance criteria, success metrics, non-goals, dependencies, edge cases all present
- 3: Most sections present but some lack depth
- 0: Missing critical sections

### 2. Testability

Can QA write test cases directly from this?

- 5: Every requirement has measurable criteria (e.g., "P95 <200ms")
- 3: Some testable, many vague ("should be fast")
- 0: All requirements subjective

### 3. Scoping Clarity

Is it obvious what's in/out of scope?

- 5: Clear "In scope" and "Non-goals" sections with explicit rationale
- 3: Scope somewhat clear but edge cases not addressed
- 0: No clear boundaries

### 4. Decision Framework

Are trade-offs documented?

- 5: Constraints, trade-offs, and rationale explained (e.g., "PostgreSQL for ACID")
- 3: Some decisions explained, thin rationale
- 0: No explanation of choices

### 5. Dependency Mapping

Are blockers identified with owners?

- 5: All dependencies listed with owners and dates
- 3: Some dependencies, no owners/timing
- 0: No dependency identification

## Required Elements

Check presence and quality:

| Element             | Present? | Quality      |
| ------------------- | -------- | ------------ |
| Acceptance criteria | [Y/N]    | [Assessment] |
| Success metrics     | [Y/N]    | [Assessment] |
| Non-goals           | [Y/N]    | [Assessment] |
| Dependencies        | [Y/N]    | [Assessment] |

## Anti-Patterns

Flag these:

- "Should be performant" - Not testable
- "Improve UX" - Not measurable
- No edge case handling specified
- Missing acceptance criteria
- No non-goals section
- Vague user stories without scenarios

## Verdict

Calculate overall score (average of 5 dimensions):

- **ACCEPT** (>=4.2): Ready for engineering, <2 critical gaps
- **REVISE** (3.0-4.1): Needs fixes before handoff
- **REJECT** (<3.0): Fundamentally incomplete

## Output Format

```
## PRD Evaluation: [PRD Title]

### Scores
| Dimension | Score | Notes |
|-----------|-------|-------|
| Completeness | X/5 | [Brief] |
| Testability | X/5 | [Brief] |
| Scoping | X/5 | [Brief] |
| Decisions | X/5 | [Brief] |
| Dependencies | X/5 | [Brief] |

**Overall: X.X/5 - [VERDICT]**

### Critical Gaps
1. [Gap description]
2. [Gap description]

### Top Fixes

**Fix 1: [Location in PRD]**
- Problem: [What's wrong]
- Current: "[Exact text]"
- Replace with: "[Exact replacement]"
- Why: [Impact on engineering]

**Fix 2: [Location in PRD]**
...
```

## Rules

- Give 3-5 specific fixes with exact replacement text
- Point to exact locations in the PRD
- Prioritize fixes by impact on engineering clarity
- Use ask tool if PRD is unclear
