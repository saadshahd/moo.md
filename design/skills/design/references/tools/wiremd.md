# WireMD Wireframes

Generate low-fidelity wireframes from markdown. External CLI tool.

**Status:** ⚠️ Experimental (Nov 2025, v0.1.x)

## When to Use

| Trigger | Use This Tool |
|---------|---------------|
| Visualizing user flows | Sketch screens |
| Lo-fi prototype needed | Quick mockups |
| Presenting IA structure | Interactive hierarchy |
| Design handoff | Developers can read/edit |

## Installation

```bash
npm install -g wiremd
```

## Basic Usage

```bash
wiremd input.md --style sketch -o output.html
wiremd input.md --watch                         # Live reload
wiremd input.md --serve                         # Dev server
```

## Styles

| Style | Look |
|-------|------|
| `sketch` | Hand-drawn, Balsamiq-like (recommended for lo-fi) |
| `wireframe` | Clean lines, formal |
| `clean` | Minimal, modern |
| `material` | Material Design |
| `tailwind` | Tailwind CSS styling |
| `brutal` | Bold, high-contrast |
| `none` | Unstyled semantic HTML |

---

## Complete Syntax Reference

### Navigation Bars

```markdown
[[ Logo | Home | Products | About | Contact ]]
[[ :logo: Brand | Home | [Sign In] ]]{.nav}
```

- Pipe `|` separates items
- Icons with `:icon-name:`
- Buttons with `[Button]`

### Buttons

```markdown
[Button Text]                    # Basic button
[Button Text]*                   # Primary/active
[Button Text]{.primary}          # Class-based
[Button Text]{:disabled}         # Disabled state
[Submit]{.primary :loading}      # Combined states
```

### Text Inputs

```markdown
[_______________]                          # Empty input
[Email_______________]                     # With placeholder
[_______________]{type:email required}     # With attributes
[***********************]                  # Password field
```

### Textareas

```markdown
[ ]
[ ]
[ ]                                        # Multi-line visual

[Message...]{rows:5}                       # Compact with rows
```

### Dropdowns

```markdown
[Choose option___________v]
[Choose option___________v]{required}
- Option 1
- Option 2
- Option 3
```

### Radio Buttons

```markdown
( ) Unselected option
(•) Selected option
(x) Alternative selected
```

### Checkboxes

```markdown
- [ ] Unchecked
- [x] Checked
```

### Icons

```markdown
:house: :user: :gear: :search: :menu:
:logo: :cart: :heart: :star: :close:
```

---

## Containers

### Generic Containers

```markdown
::: hero
# Welcome
Your tagline here
[Get Started]{.primary}
:::

::: card
### Feature
Description text
:::

::: modal
## Dialog Title
Content here
[Cancel] [Confirm]{.primary}
:::

::: alert
⚠️ Warning message here
:::
```

Container types: `hero`, `card`, `modal`, `sidebar`, `footer`, `alert`

### Inline Containers

```markdown
[[ item 1 | item 2 | item 3 ]]
```

---

## Layouts

### Grid Layouts

```markdown
## Features {.grid-3}

### Feature One
Description

### Feature Two
Description

### Feature Three
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

---

## Attributes

### Classes

```markdown
{.primary}
{.class-one .class-two}
```

### Key-Value

```markdown
{type:email}
{rows:5}
{placeholder:"Enter text"}
```

### States

```markdown
{:disabled}
{:loading}
{:active}
{:error}
{:success}
```

### Combined

```markdown
[Submit]{.primary type:submit :disabled}
```

---

## State Patterns

### Loading State

```markdown
::: loading
:spinner: Loading...
Please wait
:::
```

### Empty State

```markdown
::: empty-state
:empty-box:
## No items found
[Create Item]{.primary}
:::
```

### Error State

```markdown
::: error-state
:warning:
## Something went wrong
[Retry]{.primary}
:::
```

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

## Output Formats

| Format | Command |
|--------|---------|
| HTML | `wiremd input.md -o output.html` |
| JSON | `wiremd input.md --format json` |
| React | `wiremd input.md --format react` |
| Tailwind | `wiremd input.md --format tailwind` |

## Figma Import

WireMD exports can be imported into Figma via the WireMD Figma Plugin as fully editable native Figma designs.

---

_Source: [WireMD](https://wiremd.dev/), [Syntax Spec v0.1](https://github.com/akonan/wiremd/blob/main/SYNTAX-SPEC-v0.1.md)_
