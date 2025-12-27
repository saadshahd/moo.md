# Design System

Establish design system principles conceptually. Foundation for consistent, accessible, scalable design.

## ⚠️ Required Inputs

Ask for ALL before proceeding. Never assume.

- **Chosen direction** (from directions workflow) — Source: [?] Confidence: [H/M/L]
- **Component scope** (what needs to be designed) — Source: [?] Confidence: [H/M/L]
- **Platform requirements** (web, mobile, both) — Source: [?] Confidence: [H/M/L]
- **Accessibility target** (WCAG level) — Source: [?] Confidence: [H/M/L]
- **Scale expectations** (how much will this grow) — Source: [?] Confidence: [H/M/L]

If inputs missing → ASK. If >50% low confidence → FLAG.

## Core Principles

1. **Principles over tokens**: Philosophy that guides decisions, not just values
2. **Accessibility is structural**: Built into every domain, not a checklist
3. **Include anti-patterns**: What to avoid is as important as what to do
4. **Flexibility points explicit**: Where variation is allowed vs forbidden

## Output Structure

### System Philosophy

Core principles (3-5), prioritized design values, accessibility commitment

### Color Principles

Roles, hierarchy, accessibility approach, what to avoid

### Typography Principles

Scale philosophy, type roles, readability, hierarchy approach

### Spacing Principles

Density, rhythm, grid philosophy, component spacing

### Motion Principles

Purpose, timing, easing, reduced motion approach

### Component Patterns

State system, feedback patterns, loading patterns

### System Summary

Key decisions with rationale, consistency rules, flexibility points, open questions

## Anti-Patterns

- ❌ Tokens without principles — values without guidance on when to use them
- ❌ Accessibility as separate layer — should be woven into each domain
- ❌ No flexibility points — too rigid for real-world adaptation

## Commitment Readiness

Before moving to implementation:

- [ ] Principles documented for each domain
- [ ] Accessibility approach defined
- [ ] Flexibility points explicit
- [ ] Open questions flagged

**Handoff artifact:** Design principles document

## Handoff Options

Before generating final output, ask:

> What format would you like for handoff?
> 1. **DTCG JSON** — Full design tokens for Figma/code
> 2. **Marp slides** — Presentation deck for stakeholders
> 3. **Figma AI prompt** — Component library starter
> 4. **Markdown** — Structured text (copy-paste anywhere)

### DTCG Token Structure

```json
{
  "$schema": "https://design-tokens.org/schema.json",
  "color": {
    "primary": { "$type": "color", "$value": "#0066FF" },
    "background": { "$type": "color", "$value": "#FFFFFF" },
    "text": { "$type": "color", "$value": "#111827" }
  },
  "typography": {
    "font-family": {
      "base": { "$type": "fontFamily", "$value": "Inter, sans-serif" }
    },
    "font-size": {
      "base": { "$type": "dimension", "$value": "16px" }
    }
  },
  "spacing": {
    "4": { "$type": "dimension", "$value": "16px" },
    "8": { "$type": "dimension", "$value": "32px" }
  }
}
```

## Related Workflows

- **Before:** directions
- **After:** copy (voice alignment)
- **Complements:** compare (competitor system patterns)
