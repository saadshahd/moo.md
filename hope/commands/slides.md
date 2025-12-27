---
description: Generate Marp presentation slides from content. Outputs markdown file ready for marp CLI.
---

# /slides

Generate presentation slides from structured content using Marp markdown format.

## Input

$ARGUMENTS

Context from current conversation or explicit content request.

## Process

### 1. Determine Content Source

- If arguments specify a topic/content, use that
- If in a workflow context (journey, IA, directions, etc.), use those outputs
- If unclear, ask: "What content should I create slides for?"

### 2. Ask for Preferences

```
What style of slides do you need?

1. **Presentation** — Full deck with title slide, sections, conclusion
2. **Summary** — Key points only, minimal slides
3. **Walkthrough** — Step-by-step, one concept per slide
```

### 3. Generate Marp Markdown

Follow rules from [Marp tool reference](../skills/soul/references/tools/marp.md).

**Required front matter:**
```yaml
---
marp: true
theme: default
paginate: true
---
```

**Content rules (CRITICAL — prevent overflow):**

| Rule | Limit |
|------|-------|
| Bullet points per slide | Max 5 |
| Characters per bullet | Max 60 |
| Words per slide | Max 75 |
| Key message | One per slide |

**Structure:**
1. Title slide (use `<!-- _class: lead -->` + `<!-- _paginate: skip -->`)
2. Agenda/overview (if presentation style)
3. Content slides (one key point each)
4. Summary/conclusion slide

### 4. Write Output File

```bash
# Create slides directory if needed
mkdir -p slides

# Write markdown file
```

Use Write tool to create `slides/<topic>.md`

### 5. Provide CLI Instructions

```bash
# Preview
marp slides/<topic>.md --preview

# Generate PDF
marp slides/<topic>.md -o slides/<topic>.pdf

# Generate PowerPoint
marp slides/<topic>.md -o slides/<topic>.pptx
```

## Example Output

For a user journey presentation:

```markdown
---
marp: true
theme: gaia
paginate: true
---

<!-- _class: lead -->
<!-- _paginate: skip -->

# Checkout Flow Analysis
## User Journey Review

---

# Key Finding

**40% drop-off at payment step**

Users abandon when asked for payment details

---

## Discovery Stage

- Browse products (😊 High satisfaction)
- Search works well
- Add to cart is smooth

---

## Checkout Stage

- Cart review (😐 Neutral)
- **Payment entry (😟 Major friction)**
- Confirmation (😊 Relief)

---

<!-- _class: lead -->
<!-- _backgroundColor: #2ecc71 -->
<!-- _color: white -->

# Recommendation

Simplify payment to single step

**Expected: +15% conversion**
```

## Requirements

- Marp CLI must be installed: `npm install -g @marp-team/marp-cli`
- For PDF output: Chrome/Chromium required

## Related

- [Marp Tool Reference](../skills/soul/references/tools/marp.md)
