---
description: Generate WireMD wireframe from design exploration outputs. Outputs markdown ready for wiremd CLI.
---

# /wireframe

Generate low-fidelity wireframe using WireMD syntax.

## Input

$ARGUMENTS

Context from current design workflow or explicit screen/flow request.

## Process

### 0. Check WireMD Installation

1. Run: `which wiremd`
2. If not found, use AskUserQuestion:
   ```
   WireMD CLI is not installed. Would you like me to install it?

   Command: npm install -g wiremd@0.1.5

   [Yes, install it] / [No, show manual instructions]
   ```
3. If approved: Run `npm install -g wiremd@0.1.5` then verify with `wiremd --version`
4. If declined: Continue generating markdown, include install instructions in output

### 1. Determine Content Source

- If in a workflow context (journey, IA, directions), use those outputs
- If arguments specify a screen/flow, use that
- If unclear, ask: "What screen or flow should I wireframe?"

### 2. Generate WireMD Markdown

Follow syntax from [WireMD tool reference](../skills/design/references/tools/wiremd.md).

**Generation Rules (v0.1.5):**
- NO nested `:::` containers — use flat structure
- Grids via heading hierarchy: `## Title {.grid-N}` → `### Item` subheadings
- Use `---` horizontal rules to separate sections
- Use inline HTML (`<small>`, `<span>`) for extra styling
- Use backticks for badges: `status`
- Only use styled container types: hero, card, modal, alert, footer, section, states

**Structure:**
1. Navigation bar (if applicable)
2. Hero/header section
3. Main content area (grids via headings OR flat cards)
4. Actions/CTAs
5. Footer (if applicable)

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

### Widget A <small>SKU-001</small>
$29.99 `in stock`
- [x] Available
[Add to Cart]{.primary}

### Widget B <small>SKU-002</small>
$49.99 `out of stock`
- [ ] Unavailable
[Notify Me]

### Widget C <small>SKU-003</small>
$19.99 `in stock`
- [x] Available
[Add to Cart]{.primary}

---

::: alert {:success}
Showing 3 of 42 products
:::

---

::: footer
[[ Privacy | Terms | Help ]]
:::
```

**Key patterns:**
- Flat structure (no nested `:::` blocks)
- Grid items via heading hierarchy (`##` → `###`)
- Inline HTML for styling (`<small>`)
- Badges via backticks
- Sections separated by `---`

## Requirements

- WireMD CLI v0.1.5: Auto-detected and installed on first use
- Manual install: `npm install -g wiremd@0.1.5`
- See [CLI Install Pattern](../../hope/skills/soul/references/cli-install.md)

## Related

- [WireMD Tool Reference](../skills/design/references/tools/wiremd.md)
- [Figma AI Prompt Command](figma-prompt.md)
