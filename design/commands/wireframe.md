---
description: Generate WireMD wireframe from design exploration outputs. Outputs markdown ready for wiremd CLI.
---

# /wireframe

Generate low-fidelity wireframe using WireMD syntax.

## Input

$ARGUMENTS

Context from current design workflow or explicit screen/flow request.

## Process

### 1. Determine Content Source

- If in a workflow context (journey, IA, directions), use those outputs
- If arguments specify a screen/flow, use that
- If unclear, ask: "What screen or flow should I wireframe?"

### 2. Generate WireMD Markdown

Follow syntax from [WireMD tool reference](../skills/design/references/tools/wiremd.md).

**Structure:**
1. Navigation bar (if applicable)
2. Hero/header section
3. Main content area (use grids for multiple items)
4. Actions/CTAs
5. Footer (if applicable)

**Best practices:**
- Use `::: container` blocks for sections
- Use `.grid-N` for multi-column layouts
- Use state patterns (`:loading`, `:empty-state`) where relevant
- Keep it low-fidelity — sketchy style recommended

### 3. Write Output File

```bash
mkdir -p wireframes
```

Use Write tool to create `wireframes/<screen-name>.md`

### 4. Provide CLI Instructions

```bash
# Preview with sketch style
wiremd wireframes/<name>.md --style sketch --serve

# Generate HTML
wiremd wireframes/<name>.md --style sketch -o wireframes/<name>.html

# Export for React
wiremd wireframes/<name>.md --format react
```

## Example Output

For a product listing screen:

```markdown
[[ :logo: Store | Products | Cart :cart: | [Sign In] ]]{.nav}

---

::: hero
# Our Products
Find what you're looking for

[Search_______________] [Filter]{.secondary}
:::

---

## Products {.grid-3}

::: card
### Widget A
$29.99
- [x] In stock
[Add to Cart]{.primary}
:::

::: card
### Widget B
$49.99
- [ ] Out of stock
[Notify Me]
:::

::: card
### Widget C
$19.99
- [x] In stock
[Add to Cart]{.primary}
:::

---

[[ :house: Home | :folder: Products ]]

::: footer
[[ Privacy | Terms | Help ]]
:::
```

## Requirements

- WireMD CLI: `npm install -g wiremd`

## Related

- [WireMD Tool Reference](../skills/design/references/tools/wiremd.md)
- [Figma AI Prompt Command](figma-prompt.md)
