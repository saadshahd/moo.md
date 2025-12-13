# Content Evaluation

Evaluate blog posts and content for quality, specificity, and actionability.

## Input Required

Ask for:

- Content to evaluate (paste or file path)
- Context: What's the goal of this content?

## Evaluation Dimensions

Score each 0-5:

### 1. Specificity

Does it contain concrete, verifiable examples?

- 5: At least 3 specific examples with names, numbers, or dates
- 3: 1-2 specific examples, some claims remain generic
- 0: Entirely generic ("many customers", "significant improvements")

### 2. Proof Density

Are claims backed by evidence?

- 5: Every major claim has data, quotes, or sources
- 3: Some claims backed, key assertions lack proof
- 0: All assertions, no backing

### 3. Positioning Clarity

Is audience and problem immediately clear?

- 5: First paragraph names audience, problem, and solution
- 3: Requires several paragraphs to understand relevance
- 0: Unclear who should care

### 4. Differentiation

Does it explain why not alternatives?

- 5: Explicitly addresses competitors/status quo with unique POV
- 3: Mentions alternatives but vague differentiation
- 0: Could be about any product in category

### 5. Call-to-Action

Is next step clear and low-friction?

- 5: Specific next step matching reader intent
- 3: Generic CTA ("learn more", "contact us")
- 0: No CTA or buried/vague

## Anti-Patterns to Flag

- "Best-in-class" without proof
- Metrics without context ("40% faster" - than what?)
- "Trusted by 1000+ companies" without naming any
- Generic pain points ("save time and money")
- Vague timeframes ("recently we've seen")

## Output Format

Return JSON:

```json
{
  "overall_score": 3.8,
  "axis_scores": {
    "specificity": 4,
    "proof_density": 3,
    "positioning_clarity": 4,
    "differentiation": 3,
    "call_to_action": 5
  },
  "verdict": "ACCEPT/REVISE/REJECT",
  "critical_gaps": ["[Gap 1]", "[Gap 2]"],
  "top_fixes": [
    {
      "priority": 1,
      "location": "[Where in content]",
      "problem": "[What's wrong]",
      "current": "[Exact text]",
      "fix": "[Exact replacement]",
      "why": "[Impact of fix]"
    }
  ]
}
```

## Verdict Thresholds

- **ACCEPT** (>=4.2): Ready to publish, <2 critical gaps
- **REVISE** (3.0-4.1): Needs fixes before publishing
- **REJECT** (<3.0): Fundamentally incomplete

## Rules

- Give 3-5 specific fixes with exact replacement text
- Point to exact locations in the content
- Prioritize fixes by impact on credibility and reader action
- Use ask tool if content purpose is unclear
