# Visual Directions

Explore visual directions conceptually. Mood, rationale, principles — not implementation tokens.

## ⚠️ Required Inputs

Ask for ALL before proceeding. Never assume.

- **Brand attributes** (3-5 adjectives) — Source: [?] Confidence: [H/M/L]
- **Target audience** — Source: [?] Confidence: [H/M/L]
- **Accessibility requirements** (WCAG level) — Source: [?] Confidence: [H/M/L]
- **Constraints** (from constraints workflow) — Source: [?] Confidence: [H/M/L]
- **References** (what they like, what to avoid) — Source: [?] Confidence: [H/M/L]

If inputs missing → ASK. If >50% low confidence → FLAG.

## Reasoning Step (Before Generating)

Before creating directions, explicitly identify:

1. **3 distinct conceptual axes** you'll explore (e.g., warm vs cool, minimal vs rich, formal vs playful)
2. **What you're intentionally avoiding** and why
3. **How each direction will be meaningfully different**

## Core Principles

1. **3 directions, meaningfully different**: Not variations — distinct concepts
2. **Conceptual, not implementation**: Mood and rationale, no hex codes or font names
3. **Include what we're NOT doing**: Explicit about tradeoffs
4. **Accessibility is core**: Baked in, not afterthought

## Output Structure

### Design Brief

Brand essence, audience context, accessibility baseline, constraints

### Direction 1: [Evocative Name]

- Color story (mood, temperature, contrast approach)
- Typography character (personality, hierarchy philosophy)
- Motion philosophy (tempo, key moments)
- Emotional impact (first impression, sustained feeling)
- Best for / Struggles when
- What we're NOT doing (and why)

### Direction 2 & 3

Same structure, meaningfully different

### Comparison Matrix

Mood, energy, formality, differentiation, accessibility, risk level

### Decision Framework

Questions to consider, hybrid possibilities, next steps

## Anti-Patterns

- ❌ Variations instead of directions — subtle differences don't expand exploration
- ❌ Generic defaults — Inter, purple gradients, safe layouts
- ❌ Implementation details — hex codes, font names, pixel values
- ❌ Accessibility as afterthought — build it in from the start

## Commitment Readiness

Before moving to next workflow:

- [ ] 3 meaningfully different directions generated
- [ ] Stakeholder preference captured
- [ ] Direction chosen with rationale documented
- [ ] What we're NOT doing is explicit

**Handoff artifact:** Chosen direction brief with rationale

## Handoff Options

Before generating final output, ask:

> What format would you like for handoff?
> 1. **Marp slides** — Presentation deck for stakeholders (`/hope:slides`)
> 2. **Figma AI prompt** — Text to paste into Figma AI (`/design:figma-prompt`)
> 3. **DTCG JSON** — Design tokens for implementation (`/design:tokens`)
> 4. **Markdown** — Structured text (copy-paste anywhere)

### DTCG Token Preview

From a chosen direction, extract preliminary tokens:

```json
{
  "color": {
    "primary": {
      "$type": "color",
      "$value": "#[from direction]",
      "$description": "[mood/rationale]"
    }
  }
}
```

Note: Full tokens should wait for System workflow. Directions produce conceptual guidance, not implementation values.

## Related Workflows

- **Before:** constraints, journey, ia
- **After:** system, copy
- **Complements:** compare (competitor visual patterns)
