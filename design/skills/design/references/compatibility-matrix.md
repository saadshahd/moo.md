# Compatibility Matrix

Dimension combinations for design workflows. Use to select optimal workflow sequencing and parameter pairings.

## Workflow x Project Phase

|                   | Discovery | Definition | Design | Validation |
|-------------------|-----------|------------|--------|------------|
| Constraints       | ✓✓        | ✓✓         | ✓      | ✗          |
| Journey Mapping   | ✓✓        | ✓          | ✗      | ✓          |
| Info Architecture | ✓         | ✓✓         | ✓      | ✗          |
| Visual Directions | ✗         | ✓✓         | ✓✓     | ✗          |
| Design System     | ✗         | ✓          | ✓✓     | ✓          |
| Microcopy         | ✗         | ✓          | ✓✓     | ✓✓         |
| UX Comparison     | ✓✓        | ✓✓         | ✓      | ✓          |
| Design Critique   | ✗         | ✓          | ✓✓     | ✓✓         |

**Notes:**
- Visual Directions + Discovery: Premature; need constraints and journey first
- Journey Mapping + Design Phase: Too late; should inform structure, not react to it
- Design System + Discovery: Tokens without context; establish principles first
- Constraints + Validation: Should be locked by now; revisiting signals scope creep

## Visual Direction Type x Brand Attribute

|                | Minimal | Bold | Warm | Technical | Premium | Playful |
|----------------|---------|------|------|-----------|---------|---------|
| Warm Palette   | ✓       | ✓✓   | ✓✓   | ✗         | ✓       | ✓✓      |
| Cool Palette   | ✓✓      | ✓    | ✗    | ✓✓        | ✓✓      | ✓       |
| High Contrast  | ✓       | ✓✓   | ✗    | ✓✓        | ✓       | ✓       |
| Soft Contrast  | ✓✓      | ✗    | ✓✓   | ✗         | ✓✓      | ✓       |
| Dense Layout   | ✗       | ✓✓   | ✗    | ✓✓        | ✗       | ✓       |
| Spacious Layout| ✓✓      | ✓    | ✓✓   | ✗         | ✓✓      | ✓       |

**Notes:**
- Warm + Technical: Warmth softens precision; technical brands need clarity over comfort
- Soft Contrast + Bold: Contradictory; bold demands visual weight
- Dense + Minimal: Density violates minimalism's core principle
- Dense + Warm: Crowding feels overwhelming, not welcoming
- Cool + Warm: Direct opposition; pick one temperature

## Handoff Format x Stakeholder

|              | Designers | Developers | Executives | Clients |
|--------------|-----------|------------|------------|---------|
| DTCG JSON    | ✓✓        | ✓✓         | ✗          | ✗       |
| Marp Slides  | ✓         | ✗          | ✓✓         | ✓✓      |
| Figma Prompt | ✓✓        | ✗          | ✗          | ✓       |
| WireMD       | ✓         | ✓✓         | ✗          | ✓       |
| Mermaid      | ✓         | ✓✓         | ✓          | ✗       |
| Markdown     | ✓         | ✓          | ✓          | ✓       |

**Notes:**
- DTCG JSON + Executives/Clients: Implementation detail; need visual storytelling
- Marp + Developers: Slides lack technical specificity they need
- Figma Prompt + Developers: Not actionable for code implementation
- Mermaid + Clients: Technical diagram syntax; prefer visual formats

## Accessibility Level x Design Approach

|            | WCAG A | WCAG AA | WCAG AAA |
|------------|--------|---------|----------|
| Minimal    | ✓✓     | ✓✓      | ✓        |
| Bold       | ✓✓     | ✓       | ✗        |
| Dense      | ✓      | ✗       | ✗        |
| Playful    | ✓      | ✓       | ✗        |
| Motion-Rich| ✓      | ✓       | ✗        |

**Notes:**
- Dense + AA/AAA: Touch targets and spacing constraints conflict with density
- Bold + AAA: High-contrast requirements may clash with bold color choices
- Motion-Rich + AAA: Requires extensive reduced-motion alternatives
- Playful + AAA: Cognitive load considerations limit decorative elements

## Journey Confidence x Recommended Action

|                    | High Confidence | Medium Confidence | Low Confidence |
|--------------------|-----------------|-------------------|----------------|
| Proceed to IA      | ✓✓              | ✓                 | ✗              |
| Proceed to Visuals | ✓✓              | ✗                 | ✗              |
| User Research      | ✗               | ✓✓                | ✓✓             |
| Stakeholder Review | ✓               | ✓✓                | ✓✓             |
| Prototype Test     | ✓✓              | ✓✓                | ✗              |

**Notes:**
- Low Confidence + Proceed: Building on assumptions; high rework risk
- Low Confidence + Prototype: Testing hypotheses you haven't validated
- High Confidence + Research: Diminishing returns; move forward

## Workflow Sequence Compatibility

Standard flow: `constraints → journey → ia → directions → system → copy`

| From → To        | Direct | Skip One | Skip Two+ |
|------------------|--------|----------|-----------|
| Constraints → IA | ✓      | -        | -         |
| Journey → Dirs   | ✓      | -        | -         |
| Constraints → Dirs | -    | ✓        | -         |
| Constraints → System | -  | -        | ✗         |
| Journey → System | -      | -        | ✗         |

**Notes:**
- Skipping to System: Tokens without principles; values without context
- Skipping Journey: Missing emotional arc that should inform visual choices
- compare/critique: Can enter at any point; research and feedback always valuable

## Usage

1. Identify your current workflow and target handoff
2. Cross-reference with project phase and stakeholder
3. Check accessibility requirements against design approach
4. Prefer ✓✓ combinations; ✓ works with care; avoid ✗
5. When ✗ is necessary, document the tradeoff in design brief
