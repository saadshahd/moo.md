---
description: Generate WireMD wireframe from design exploration. Outputs markdown for wiremd CLI.
---

# /wireframe

Generate low-fidelity wireframe using WireMD syntax.

## Example (Correct Syntax)

```markdown
[[ :logo: Store | Products | Cart :cart: | [Sign In] ]]{.nav}

::: hero

# Our Products

Find what you're looking for

[Search_______________] [Filter]{.secondary}

:::

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

::: success-state

Showing 3 of 42 products

:::

::: footer

[[ Privacy | Terms | Help ]]

:::
```

## Goal

Generate low-fidelity wireframe markdown that renders correctly with WireMD CLI v0.1.5.

## Constraints

- NO nested `:::` containers
- Blank line after every `:::` opening
- Blank line between EVERY element inside containers
- Blank line before every `:::` closing
- Use state containers: `error-state`, `success-state`, `warning-state`, `empty-state`, `loading-state`
- Grids via heading hierarchy: `## Title {.grid-N}` → `### Item`
- Badges via backticks: `status`
- NO `---` horizontal rules

## Adapt to Context

If the design requires patterns not in WireMD, use inline HTML or simplify the wireframe.

## Input

$ARGUMENTS

Context from current design workflow or explicit screen/flow request.

## Process

1. **Check WireMD installation** — Run `which wiremd`. If not found, ask to install with `npm install -g wiremd@0.1.5`
2. **Determine source** — Use workflow context, arguments, or ask for screen/flow
3. **Generate markdown** — Follow constraints above and [WireMD reference](../skills/design/references/tools/wiremd.md)
4. **Write file** — `wireframes/<screen-name>.md`
5. **Provide CLI commands**

## CLI Commands

```bash
# Preview with sketch style (specify port)
wiremd wireframes/<name>.md --style sketch --serve 3200

# Generate HTML
wiremd wireframes/<name>.md --style sketch -o wireframes/<name>.html

# Export for React
wiremd wireframes/<name>.md --format react
```

## Related

- [WireMD Tool Reference](../skills/design/references/tools/wiremd.md)
- [Figma AI Prompt Command](figma-prompt.md)
