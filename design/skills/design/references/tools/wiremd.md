# WireMD Wireframes

Generate low-fidelity wireframes from markdown. External CLI tool.

**Status:** Experimental (v0.1.x)

## When to Use

| Trigger | Use This Tool |
|---------|---------------|
| Visualizing user flows | Sketch screens |
| Lo-fi prototype needed | Quick mockups |
| Presenting IA structure | Interactive hierarchy |

## Installation & Usage

```bash
npm install -g wiremd
wiremd input.md --style sketch -o output.html
wiremd input.md --watch   # Live reload
```

## Styles

`sketch` (hand-drawn) | `wireframe` (formal) | `clean` | `material` | `tailwind` | `brutal`

---

## Essential Syntax

### Navigation

```markdown
[[ Logo | Home | Products | [Sign In] ]]{.nav}
```

### Inputs & Buttons

```markdown
[_______________]             # Text input
[Email___________]            # With placeholder
[*****************]           # Password
[Submit]{.primary}            # Primary button
[Cancel]{:disabled}           # Disabled
```

### Textareas

```markdown
[ ]
[ ]
[ ]                           # Multi-line visual

[Message...]{rows:5}          # Compact with rows
```

### Form Elements

```markdown
[Choose option_______v]       # Dropdown
( ) Option A                  # Radio
(•) Selected                  # Radio selected
- [ ] Unchecked               # Checkbox
- [x] Checked                 # Checkbox checked
```

### Icons

```markdown
:house: :user: :gear: :search: :menu: :cart: :logo:
```

### Containers

```markdown
::: hero
# Welcome
[Get Started]{.primary}
:::

::: card
### Feature
Description
:::

::: modal
## Dialog Title
[Cancel] [Confirm]{.primary}
:::
```

Container types: `hero`, `card`, `modal`, `sidebar`, `footer`, `alert`

### Layouts

```markdown
## Features {.grid-3}

### Feature One
Description

### Feature Two
Description
```

Grids: `.grid-2`, `.grid-3`, `.grid-4`, `.grid-auto`

### Sidebar + Main

```markdown
::: layout {.sidebar-main}

## Sidebar {.sidebar}
- Nav item 1
- Nav item 2

## Main {.main}
Main content area

:::
```

### Attributes

```markdown
{.primary}                    # Class
{type:email required}         # Key-value
{:disabled :loading}          # States
```

---

## States

```markdown
::: loading
:spinner: Loading...
:::

::: empty-state
## No items found
[Create]{.primary}
:::

::: error-state
## Something went wrong
[Retry]{.primary}
:::
```

---

## Output Formats

| Format | Command |
|--------|---------|
| HTML | `wiremd input.md -o output.html` |
| JSON | `wiremd input.md --format json` |
| React | `wiremd input.md --format react` |

Exports can be imported into Figma via WireMD Figma Plugin.

---

## Complete Example

```markdown
[[ :logo: MyApp | Dashboard | Products | [Sign Out] ]]{.nav}

---

::: hero
# Product Dashboard
Manage your inventory

[Search products_____] [Add New]{.primary}
:::

---

## Products {.grid-3}

::: card
### Widget A
$29.99
- [x] In stock
[Edit] [Delete]{:disabled}
:::

::: card
### Widget B
$49.99
- [ ] Out of stock
[Edit] [Delete]
:::

::: card
### Widget C
$19.99
- [x] In stock
[Edit] [Delete]
:::

---

::: footer
[[ Privacy | Terms | Contact ]]
:::
```

---

_Full syntax: [wiremd.dev](https://wiremd.dev/), [Syntax Spec v0.1](https://github.com/akonan/wiremd/blob/main/SYNTAX-SPEC-v0.1.md)_
