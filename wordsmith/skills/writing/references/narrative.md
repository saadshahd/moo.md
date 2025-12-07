# Narrative Structure

Craft a 3-act story structure that lands with your audience.

## Input Required

Ask for:
- **Concept or thesis:** One-line idea
- **Target audience:** Who needs to hear this (e.g., CFOs, Gen-Z gamers, technical PMs)
- **Desired emotional outcome:** What should they feel (e.g., urgency, hope, confidence)

## Internal Reasoning

Before generating, reason through:
1. What does this audience care about?
2. What tension will resonate with them?
3. What resolution delivers the emotional outcome?

## Three-Act Structure

### Act I: Setup
- Establish the world/context
- Introduce the protagonist (could be reader, company, idea)
- Plant the seed of conflict

### Act II: Confrontation
- Escalate the tension
- Show stakes and obstacles
- Build to the turning point

### Act III: Resolution
- Deliver the payoff
- Transform the protagonist
- Call to action

## Output Format

Return JSON:

```json
{
  "three_act_outline": [
    {
      "act": "I",
      "purpose": "setup",
      "key_beats": ["[Beat 1]", "[Beat 2]"]
    },
    {
      "act": "II",
      "purpose": "confrontation",
      "key_beats": ["[Beat 1]", "[Beat 2]"]
    },
    {
      "act": "III",
      "purpose": "resolution",
      "key_beats": ["[Beat 1]", "[Beat 2]"]
    }
  ],
  "opening_hook": "[25 words max - grabs attention]",
  "closing_cta": "[25 words max - drives action]"
}
```

## Quality Checks

Before returning:
- [ ] 3 acts present
- [ ] 2 key beats per act
- [ ] Opening hook <=25 words
- [ ] Closing CTA <=25 words
- [ ] Emotional outcome is achievable through this structure

## Rules

- Keep beats concrete, not abstract
- Opening hook must create tension or curiosity
- Closing CTA must be specific and actionable
- Use ask tool if concept is unclear
