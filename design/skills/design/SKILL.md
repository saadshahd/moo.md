---
name: design
description: Explore visual design, UI/UX, and design systems. Use when designing visual directions, user journeys, information architecture, color palettes, typography, or reviewing design feedback. NOT for feature planning or technical architecture.
---

# Design Skill

Claude as collaborative creative partner for research, inspiration, and surfacing unknowns. NOT visual execution.

**Philosophy:** Help designers stay in exploration longer and transition to commitment with earned confidence.

## ⚠️ CRITICAL: Ask Before Assuming

If ANY required input is missing or unclear:

1. **STOP**
2. Use Ask tool to gather missing information
3. Do NOT proceed with assumptions

For every input, require:

- **Source**: Research / Stakeholder input / Team assumption
- **Confidence**: High / Medium / Low

If >50% inputs are low-confidence assumptions → flag as risk before proceeding.

## Workflow Selection

| Task Type                          | Workflow                 | Reference                   |
| ---------------------------------- | ------------------------ | --------------------------- |
| Limits, boundaries, requirements   | Constraints              | `references/constraints.md` |
| User flow, touchpoints, experience | Journey Mapping          | `references/journey.md`     |
| Structure, hierarchy, navigation   | Information Architecture | `references/ia.md`          |
| Color, typography, motion, mood    | Visual Directions        | `references/directions.md`  |
| Design tokens, principles          | Design System            | `references/system.md`      |
| UI copy, tone variations           | Microcopy                | `references/copy.md`        |
| Competitor flows, UX patterns      | UX Comparison            | `references/compare.md`     |
| Give/receive design feedback       | Design Critique          | `references/critique.md`    |

## Workflow Flow

```
constraints → journey → ia → directions → system
                                 ↓
                               copy

compare → (anytime for research)
critique → (anytime for feedback)
```

## Core Principles

### Exploration Mode

- Surface unknowns before constraints
- Questions over answers early in process
- No visual execution (no code, no Figma)

### Anti-Convergence

- Always generate **3+ options**
- Avoid generic defaults (Inter, purple gradients)
- Include "what we're NOT doing and why"

### Evidence-Grounded

- Every input needs Source + Confidence
- Flag assumptions explicitly
- Recommend research when confidence is low

### Accessibility-First

- WCAG considerations in every visual workflow
- Not an afterthought

## Related Thinking Tools

| Tool                                                                            | When to Use                           |
| ------------------------------------------------------------------------------- | ------------------------------------- |
| [First Principles](../../hope/skills/soul/references/tools/first-principles.md) | Question assumptions before designing |
| [Issue Trees](../../hope/skills/soul/references/tools/issue-trees.md)           | Break down complex design problems    |
| [Decision Matrix](../../hope/skills/soul/references/tools/decision-matrix.md)   | Choose between design directions      |

## Dimensions

This skill has multiple configuration dimensions. See [compatibility-matrix.md](references/compatibility-matrix.md) for:

- Workflow x Project Phase
- Visual Direction Type x Brand Attribute
- Handoff Format x Stakeholder
- Accessibility Level x Design Approach
- Journey Confidence x Recommended Action
- Workflow Sequence Compatibility

Use ✓✓ combinations when possible; avoid ✗ combinations.

## Usage

1. Detect which workflow applies
2. Check [compatibility matrix](references/compatibility-matrix.md) for dimension compatibility
3. Announce: "I'm using the design skill for [workflow]"
4. **Ask for ALL required inputs before proceeding**
5. Execute workflow with confirmation gates (see below)
6. Include commitment readiness check

## Confirmation Gates

Multi-step workflows pause at checkpoints to prevent wasted work when intent drifts.

**Gate Points:**

| Phase | Gate |
|-------|------|
| After constraints/research | ⚠️ CHECKPOINT: "Does this understanding match your intent?" |
| After options generation | ⚠️ CHECKPOINT: "Here are the directions. Which resonates before I expand?" |
| Before final output | ⚠️ CHECKPOINT: "Ready to finalize. Confirm?" |

**Skip gates:** Say "proceed without confirmation" to run uninterrupted.

**In workflows:** Each reference file should pause at these points:

```
### Phase 2: Exploration

[... phase content ...]

⚠️ **CHECKPOINT**: Present options summary. Ask: "Do these directions capture what you're looking for? Any adjustments before I continue?"
```
