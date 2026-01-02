# WireMD Wireframes

Generate low-fidelity wireframes from markdown. External CLI tool.

**Version:** 0.1.5 (pin this version — alpha tool, breaking changes possible)

## When to Use

| Trigger | Use This Tool |
|---------|---------------|
| Visualizing user flows | Sketch screens |
| Lo-fi prototype needed | Quick mockups |
| Presenting IA structure | Interactive hierarchy |

## Installation

```bash
npm install -g wiremd@0.1.5
wiremd input.md --style sketch -o output.html
wiremd input.md --serve 3200   # Live reload on port 3200
```

## Styles

`sketch` (hand-drawn) | `wireframe` (formal) | `clean` | `material` | `tailwind` | `brutal`

---

## What Works vs What Doesn't

### Works
| Syntax | Notes |
|--------|-------|
| Single `:::` containers | No nesting |
| `{.class}` attributes | Single or multiple classes |
| Inline HTML (`<small>`, `<span>`) | Passed through to output |
| Grid via heading hierarchy | See below |
| Standard markdown | Headings, bold, lists, links |

### Does NOT Work
| Syntax | Issue |
|--------|-------|
| Nested `:::` inside `:::` | Parser doesn't handle recursion |
| `{.sidebar-main}` layout | Documented but non-functional |
| Custom CSS classes | Adds class but no styling — only predefined types render |
| Quoted attributes `{key:"value"}` | No quote handling |

---

## Essential Syntax

### Navigation

```markdown
[[ :logo: Brand | Home | Products | [Sign In] ]]{.nav}
```

### Buttons

```markdown
[Button]                      # Basic
[Submit]*                     # Primary (asterisk suffix)
[Submit]{.primary}            # Primary (class)
[Cancel]{.secondary}          # Secondary
[Delete]{.danger}             # Danger
[Disabled]{:disabled}         # Disabled state
```

### Inputs

```markdown
[_______________]             # Text input
[Email___________]            # With placeholder
[*****************]           # Password
[___]{type:email required}    # With attributes
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
[Choose option_______v]       # Dropdown (v suffix)
( ) Option A                  # Radio unselected
(•) Selected                  # Radio selected
- [ ] Unchecked               # Checkbox
- [x] Checked                 # Checkbox checked
```

### Icons

```markdown
:house: :user: :gear: :search: :menu: :cart: :logo: :rocket: :shield:
```

### Badges (Backtick Syntax)

```markdown
Status `active`               # Renders as badge/pill
Notifications `3`
Version `beta`
```

---

## Containers (Styled Types Only)

**Critical:** Every container needs blank lines after opening `:::`, between elements, and before closing `:::`.

Only these container types have CSS styling:

```markdown
::: hero

# Welcome

[Get Started]{.primary}

:::

::: card

### Feature Title

Description text

:::

::: modal

## Dialog Title

[Cancel] [Confirm]{.primary}

:::

::: footer

[[ Privacy | Terms | Contact ]]

:::

::: section

General content section

:::
```

### State Containers

Use these for feedback states:

```markdown
::: error-state

Error: Something went wrong

[Retry]{.primary}

:::

::: success-state

Success: Operation completed

:::

::: warning-state

Warning: Check your input

:::

::: empty-state

No items found

[Create]{.primary}

:::

::: loading-state

:spinner: Loading...

:::
```

---

## Grid Layout (Heading Hierarchy)

Grids use implicit heading hierarchy — NOT nested containers:

```markdown
## Features {.grid-3}

### Feature One
Fast and reliable performance

### Feature Two
Enterprise-grade security

### Feature Three
Powerful developer tools
```

**Rules:**
- Heading with `{.grid-N}` becomes grid container
- Subheadings (exactly +1 level) become grid items
- Content after subheading belongs to that item
- Stops at next heading at same or higher level

Grids: `.grid-2`, `.grid-3`, `.grid-4`, `.grid-auto`

---

## Inline HTML

Inline HTML tags pass through to output:

```markdown
**Product Name** <small>500mg</small>

<span>Styled text</span>

Price: <strong>$29.99</strong>
```

Use for styling that wiremd doesn't support natively.

---

## Attributes

```markdown
{.primary}                    # Single class
{.btn .large}                 # Multiple classes
{type:email required}         # Key-value pairs
{:disabled}                   # State
{rows:5}                      # Numeric value
```

---

## Output Formats

| Format | Command |
|--------|---------|
| HTML | `wiremd input.md -o output.html` |
| JSON | `wiremd input.md --format json` |
| React | `wiremd input.md --format react` |

---

## Complete Example

```markdown
[[ :logo: MyApp | Dashboard | Products | [Sign Out] ]]{.nav}

::: hero

# Product Dashboard

Manage your inventory

[Search products_____] [Add New]{.primary}

:::

## Products {.grid-3}

### Widget A <small>SKU-001</small>

$29.99

- [x] In stock

[Edit] [Delete]{:disabled}

### Widget B <small>SKU-002</small>

$49.99 `sale`

- [ ] Out of stock

[Edit] [Notify]

### Widget C <small>SKU-003</small>

$19.99

- [x] In stock

[Edit] [Delete]

::: success-state

3 products loaded successfully

:::

::: footer

[[ Privacy | Terms | Contact ]]

:::
```

**Key patterns:**
- Flat structure (no nested `:::` blocks)
- Blank lines after opening `:::`, between elements, before closing `:::`
- Grid items via heading hierarchy
- Inline HTML for extra styling (`<small>`)
- Badges via backticks (`sale`)
- State containers for feedback (success-state, error-state, etc.)

_Docs: [wiremd.dev](https://wiremd.dev/) | [Syntax Spec](https://github.com/akonan/wiremd/blob/main/SYNTAX-SPEC-v0.1.md)_
