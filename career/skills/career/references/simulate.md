# Interview Simulator Workflow

Interactive scenario-based interview practice with structured feedback.

## Input Required

Use ask tool to gather:

1. **Role Level:** Junior / Mid / Senior / Executive
2. **Domain:** Engineering / Product / Sales / Marketing / Operations / Other
3. **Company Context:** Startup / Scale-up / Enterprise
4. **Specific focus areas** (optional): Leadership, technical depth, stakeholder management, etc.

## Scenario Design

Create a messy, realistic situation involving:

- Conflicting requirements from multiple stakeholders
- Incomplete or contradictory data
- Time pressure requiring trade-off decisions
- Compliance or ethical considerations
- Resource constraints (budget, people, technology)

**The scenario must be uncomfortable.** Real interviews test judgment under pressure, not textbook answers.

## Evaluation Dimensions

Score user response on 5 dimensions (1-5 each):

### 1. Constraint Discovery
- Did they identify unstated limitations?
- Did they ask clarifying questions about trade-offs?
- Did they surface assumptions that needed validation?

### 2. Systematic Thinking
- Did they break down the problem logically?
- Did they consider multiple approaches?
- Did they explain their reasoning process?

### 3. Risk Assessment
- Did they identify potential failure modes?
- Did they consider downstream consequences?
- Did they address compliance/ethical concerns?

### 4. AI Tool Usage
- Did they choose appropriate tools for tasks?
- Did they explain their verification process?
- Did they demonstrate judgment over AI outputs?

### 5. Communication Clarity
- Did they structure their response logically?
- Did they adapt to the audience?
- Did they invite feedback and iteration?

## Simulation Flow

### Step 1: Present Scenario

Present the initial scenario with enough detail to be realistic but enough ambiguity to require discovery.

End with: "How would you approach this?"

Wait for user response.

### Step 2: Provide Feedback

After user responds, provide:

```
## Evaluation

| Dimension | Score | Justification |
|-----------|-------|---------------|
| Constraint Discovery | X/5 | [Specific evidence] |
| Systematic Thinking | X/5 | [Specific evidence] |
| Risk Assessment | X/5 | [Specific evidence] |
| AI Tool Usage | X/5 | [Specific evidence] |
| Communication Clarity | X/5 | [Specific evidence] |
| **Total** | X/25 | |

## One Strength to Leverage

[What they did well—specific, not generic praise]

## One Improvement Area

[What to work on—specific suggestion with example]

## Do-Over Variant

[Same scenario with a twist for additional practice]

## Expert-Level Response (Calibration)

[How a top performer would approach this—for comparison, not copying]
```

### Step 3: Offer Continuation

Ask if they want to:
1. Try the do-over variant
2. Try a completely new scenario
3. Deep-dive on a specific weakness

## Example Scenarios by Domain

### Engineering
"Your team is 2 weeks from a major release. A security audit just found a critical vulnerability in a third-party library. The fix requires breaking API changes. Sales has already pre-sold the feature to 3 enterprise clients with contractual penalties for delays. Your senior engineer just gave notice. How do you proceed?"

### Product
"User research shows customers want Feature A (60% demand). Data shows Feature B would reduce churn by 15%. Engineering says Feature C would cut technical debt that's slowing all development. You have resources for one. Your CEO is pushing for Feature A because a board member's company needs it. What's your approach?"

### Sales
"A prospect is ready to sign a $500K deal but wants a feature that doesn't exist. Product says it's 6 months out minimum. Your competitor just announced something similar. Your commission would be $75K. The prospect's deadline is 2 weeks. What do you do?"

## Rules

- Make scenarios uncomfortable—comfort doesn't build skill
- Score based on approach, not outcome
- Provide actionable feedback, not generic praise
- Expert responses should feel out of reach but learnable
- Adapt difficulty based on stated level (don't give senior scenarios to juniors)
