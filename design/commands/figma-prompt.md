---
description: Generate a prompt for Figma AI to create designs based on workflow outputs. Copy-paste into Figma.
---

# /figma-prompt

Generate a text prompt optimized for Figma AI's design generation.

## Input

$ARGUMENTS

Context from current design workflow or explicit design request.

## Process

### 1. Determine Content Source

- If in a workflow context (directions, system, journey), use those outputs
- If arguments specify a design need, use that
- If unclear, ask: "What design do you want Figma AI to generate?"

### 2. Structure the Prompt

Figma AI responds best to structured, specific prompts:

**Template:**
```
Create a [screen type] with:

Layout:
- [Structure description]
- [Key sections]

Content:
- [Headline/copy]
- [Key elements]

Style:
- [Color approach]
- [Typography feel]
- [Mood/tone]

Components:
- [Specific UI elements needed]
```

### 3. Output the Prompt

Present as a copyable code block the user can paste into Figma AI.

## Prompt Patterns by Workflow

### From Directions Workflow

```
Create a landing page with:

Layout:
- Header: Logo left, nav right (Home, Products, About, Contact)
- Hero: Full-width, centered headline with CTA
- Features: 3-column grid below hero

Content:
- Headline: "[Brand tagline from directions]"
- CTA: "[Primary action]"

Style:
- Color palette: [colors from chosen direction]
- Typography: [type character from direction]
- Mood: [emotional impact from direction]
```

### From Journey Workflow

```
Create a [stage name] screen with:

Layout:
- Progress indicator at top
- Main content area
- Action buttons at bottom

Content:
- Step: [current stage]
- User goal: [what they're trying to do]
- Key action: [primary CTA]

Style:
- Emotional tone: [feeling at this stage]
- Friction level: [high/low based on pain points]
```

### From System Workflow

```
Create a component library starter with:

Components:
- Primary button (default, hover, disabled states)
- Secondary button
- Text input (empty, filled, error states)
- Card component
- Navigation bar

Style:
- Colors: [from system tokens]
- Typography: [from system principles]
- Spacing: [from system rhythm]
- Border radius: [from system]
```

### From IA Workflow

```
Create a navigation mockup with:

Structure:
- Primary nav: [top-level items]
- Secondary nav: [sub-items]
- Breadcrumb pattern

Content:
- Labels: [from labeling decisions]
- Hierarchy: [levels from IA]

Style:
- [Appropriate for information density]
```

## Example Output

For a checkout flow from journey workflow:

```
Create a checkout payment screen with:

Layout:
- Progress bar at top (Step 3 of 4)
- Payment form centered
- Order summary sidebar on right
- Trust badges near CTA

Content:
- Headline: "Payment Details"
- Form fields: Card number, Expiry, CVV
- CTA: "Complete Purchase"
- Trust: "Secure checkout" badge

Style:
- Clean, minimal, trustworthy
- Calm blues and greens
- Clear typography hierarchy
- Generous whitespace to reduce anxiety

Components:
- Text inputs with clear labels
- Primary CTA button (high contrast)
- Security badge icons
- Error state styling for validation
```

## Tips for Better Results

1. **Be specific about layout** — "Logo left, nav right" not just "header"
2. **Include emotional context** — Figma AI can interpret "trustworthy" or "playful"
3. **Mention key states** — hover, error, loading, empty
4. **Reference real content** — placeholder text should feel realistic
5. **Specify mobile/desktop** — if responsive matters

## Related

- [WireMD Wireframe Command](wireframe.md)
- [Tokens Export Command](tokens.md)
