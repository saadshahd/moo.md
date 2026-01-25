# Compatibility Matrix

Dimension combinations for writing workflows. Use to select optimal workflow + parameter pairings.

## Workflow x Voice Type

|                  | Formal Voice | Conversational | Technical | Playful |
|------------------|--------------|----------------|-----------|---------|
| Precision Edit   | ✓✓           | ✓✓             | ✓✓        | ✓       |
| Voice Extraction | ✓✓           | ✓✓             | ✓✓        | ✓✓      |
| Narrative        | ✓            | ✓✓             | ✗         | ✓✓      |
| Microcopy        | ✓            | ✓✓             | ✓         | ✓✓      |
| Content Eval     | ✓✓           | ✓              | ✓✓        | ✗       |

**Notes:**
- Technical + Narrative: Three-act structure clashes with precision-focused technical writing
- Playful + Content Eval: Evaluation rubric penalizes informal language patterns
- Formal + Microcopy: Works for premium brands, but character limits constrain proper formality

## Tone x Format (Microcopy)

|              | Button | Error | Tooltip | Empty State | Success |
|--------------|--------|-------|---------|-------------|---------|
| Friendly     | ✓✓     | ✓✓    | ✓✓      | ✓✓          | ✓✓      |
| Premium      | ✓✓     | ✓     | ✓       | ✓           | ✓✓      |
| Playful      | ✓      | ✓     | ✓✓      | ✓✓          | ✓✓      |
| Professional | ✓✓     | ✓✓    | ✓✓      | ✓           | ✓       |
| Urgent       | ✓✓     | ✓✓    | ✗       | ✗           | ✗       |
| Reassuring   | ✓      | ✓✓    | ✓✓      | ✓✓          | ✓       |

**Notes:**
- Urgent + Tooltip/Empty/Success: Urgency inappropriate for informational or positive moments
- Playful + Error: Risk of trivializing user frustration; use carefully
- Premium + Error: Brevity may feel cold when user needs support

## Editing Pass x Document Type

|          | Internal Doc | External Copy | High-Stakes | Blog Post |
|----------|--------------|---------------|-------------|-----------|
| Pass 1   | ✓✓           | ✓✓            | ✓✓          | ✓✓        |
| Pass 2   | ✓            | ✓✓            | ✓✓          | ✓✓        |
| Pass 3   | ✗            | ✓             | ✓✓          | ✓         |
| Pass 4+  | ✗            | ✗             | ✓           | ✗         |

**Notes:**
- Internal Doc + Pass 3+: Diminishing returns; ship and iterate from feedback
- External Copy + Pass 4+: Perfectionism trap; real-world data more valuable
- High-Stakes + Pass 4+: Legal/PR may justify extra passes, but still has limits

## Voice Dimension x Content Type

|                | Blog | RFC | Marketing | Email | Docs |
|----------------|------|-----|-----------|-------|------|
| Formal         | ✓    | ✓✓  | ✗         | ✓     | ✓✓   |
| Conversational | ✓✓   | ✗   | ✓✓        | ✓✓    | ✓    |
| Technical      | ✓    | ✓✓  | ✗         | ✓     | ✓✓   |
| Playful        | ✓    | ✗   | ✓✓        | ✓     | ✗    |
| Authoritative  | ✓✓   | ✓✓  | ✓         | ✓     | ✓✓   |

**Notes:**
- Conversational + RFC: RFCs require precise technical language; casual tone undermines credibility
- Playful + RFC/Docs: Humor distracts from precision; readers expect neutrality
- Formal + Marketing: Formal distance kills conversion; warmth builds trust
- Technical + Marketing: Jargon alienates non-technical buyers

## Narrative Structure x Audience

|              | Executives | Developers | Gen-Z | Enterprise | Consumers |
|--------------|------------|------------|-------|------------|-----------|
| Three-Act    | ✓          | ✗          | ✓✓    | ✓          | ✓✓        |
| SCQA (Minto) | ✓✓         | ✓          | ✗     | ✓✓         | ✗         |
| Open Loop    | ✓          | ✗          | ✓✓    | ✗          | ✓✓        |

**Notes:**
- Developers + Three-Act/Open Loop: Prefer direct information; narrative feels manipulative
- Executives + Open Loop: Time-constrained; want bottom-line-up-front
- Gen-Z + SCQA: Too formal; prefers emotional engagement over logical structure
- Enterprise + Open Loop: Risk-averse; cliffhangers feel unprofessional

## Usage

1. Identify your workflow from SKILL.md
2. Cross-reference with voice/format/audience dimensions
3. Prefer ✓✓ combinations; ✓ works with care; avoid ✗
4. When ✗ is necessary, document the tradeoff explicitly
