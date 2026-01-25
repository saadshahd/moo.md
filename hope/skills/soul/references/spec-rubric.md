# Spec Rubric

Single source of truth for spec clarity scoring.

## Scoring Scale

| Score | Label | Description |
|-------|-------|-------------|
| **9-10** | Crystal | Could write acceptance tests now, no questions |
| **7-8** | Clear | Minor clarifications needed, direction obvious |
| **5-6** | Fuzzy | General shape visible, significant gaps |
| **3-4** | Vague | High-level intent only, many assumptions required |
| **1-2** | Unclear | Don't know what "done" looks like |

## Scoring Dimensions

Rate each 1-10, average for total:

| Dimension | Question |
|-----------|----------|
| **Outcome** | Can I describe the end state in one sentence? |
| **Scope** | Do I know what's in and out? |
| **Acceptance** | Could I verify "done" without asking? |
| **Inputs** | Do I have everything I need to start? |
| **Constraints** | Are the rules explicit? |

## Quick Assessment

Three questions to estimate spec clarity:

1. **Could I write a test for this?** (Yes = 8+, Partially = 5-7, No = <5)
2. **Would two people build the same thing?** (Yes = 8+, Similar = 5-7, No = <5)
3. **Do I need to ask clarifying questions?** (No = 8+, Few = 5-7, Many = <5)

## Score Thresholds

| Score | Recommendation |
|-------|----------------|
| **8+** | Proceed with tool-shaped workflow |
| **5-7** | Proceed with colleague-shaped workflow |
| **<5** | Stop. Clarify spec first. |

## Improving Low Scores

| Gap | Fix |
|-----|-----|
| Outcome unclear | Write one sentence: "[Verb] [deliverable] so that [result]" |
| Scope undefined | List 3 things explicitly OUT of scope |
| Acceptance vague | Write 3 concrete "must" and 2 "must NOT" criteria |
| Inputs missing | List exact sources; if unknown, that's a blocker |
| Constraints implicit | Ask: style, format, tools, timeline |

## Common Patterns

| Spec Type | Typical Score | Action |
|-----------|---------------|--------|
| Bug report with repro steps | 8-9 | Proceed |
| Feature request with mockup | 6-7 | Clarify edge cases |
| "Make it better" | 2-3 | Full requirements gathering |
| Copy existing pattern | 8+ | Proceed |
| Novel design | 4-5 | Prototype first |

## Anti-Patterns

| Mistake | Consequence |
|---------|-------------|
| Assuming high clarity | Output misses mark, rework |
| Over-specifying obvious things | Wasted time, rigidity |
| Proceeding at score <5 | Thrashing, scope creep |
| Not re-scoring after changes | Drift from original intent |
