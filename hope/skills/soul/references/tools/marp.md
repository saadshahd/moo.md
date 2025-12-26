# Marp Slides

Generate presentation slides from markdown. External CLI tool.

## When to Use

| Trigger | Use This Tool |
|---------|---------------|
| Presenting research findings | Structure as slides |
| Sharing design exploration | Visual handoff |
| Pitch deck needed | Quick professional output |
| Journey/IA presentation | Visualize stages |

## Installation

```bash
npm install -g @marp-team/marp-cli
```

## Basic Usage

```bash
marp slides.md -o output.pdf      # PDF
marp slides.md -o output.pptx     # PowerPoint
marp slides.md -o output.html     # HTML
marp slides.md --watch            # Auto-rebuild on save
```

---

## Slide Structure

### Slide Breaks

Use `---` to separate slides:

```markdown
# Slide 1
Content here

---

# Slide 2
More content
```

### Front Matter (Required)

Always start with:

```yaml
---
marp: true
theme: default
paginate: true
---
```

---

## Directives

### Global Directives

Apply to entire deck. Place in front matter or first slide.

| Directive | Purpose | Example |
|-----------|---------|---------|
| `marp: true` | Enable Marp rendering | Required |
| `theme` | Set theme | `default`, `gaia`, `uncover` |
| `paginate` | Show page numbers | `true`, `false` |
| `header` | Text at top of slides | `header: "Company Name"` |
| `footer` | Text at bottom | `footer: "Confidential"` |
| `style` | Custom CSS | See styling section |

### Local Directives (Per-Slide)

Apply to current slide and following. Use `_` prefix for single slide only.

| Directive | Purpose | Example |
|-----------|---------|---------|
| `<!-- paginate: true -->` | Show page numbers | Affects this slide + following |
| `<!-- _paginate: false -->` | Hide on this slide only | Single slide |
| `<!-- _class: lead -->` | Center content | Title slides |
| `<!-- backgroundColor: #fff -->` | Background color | Hex or named |
| `<!-- color: #333 -->` | Text color | Hex or named |

### Pagination Options

```markdown
<!-- paginate: true -->   ← Show & increment
<!-- paginate: false -->  ← Hide but increment
<!-- paginate: hold -->   ← Show but don't increment
<!-- paginate: skip -->   ← Hide & don't increment (cover slides)
```

---

## Images

### Basic Syntax

```markdown
![](image.png)                    # Inline image
![alt text](image.png)            # With alt text
```

### Resizing

```markdown
![width:200px](image.png)         # Fixed width
![height:300px](image.png)        # Fixed height
![w:200 h:150](image.png)         # Both dimensions
![w:50%](image.png)               # Percentage
```

### Filters

```markdown
![blur:5px](image.png)
![brightness:1.5](image.png)
![contrast:150%](image.png)
![grayscale:1](image.png)
![sepia:0.5](image.png)
![opacity:0.7](image.png)
![drop-shadow:0,5px,10px,rgba(0,0,0,.4)](image.png)
```

Combine: `![w:200 grayscale:1 opacity:0.8](image.png)`

---

## Backgrounds

### Full-Slide Background

```markdown
![bg](background.jpg)             # Cover (default)
![bg contain](image.jpg)          # Fit without crop
![bg auto](image.jpg)             # Original size
![bg 50%](image.jpg)              # Scale percentage
```

### Split Backgrounds

```markdown
![bg left](image.jpg)             # Image left, content right
![bg right](image.jpg)            # Image right, content left
![bg left:40%](image.jpg)         # 40% for image
![bg right:33%](image.jpg)        # 33% for image
```

### Multiple Backgrounds

```markdown
![bg](image1.jpg)
![bg](image2.jpg)
![bg vertical](image3.jpg)        # Stack vertically
```

### Background Colors/Gradients

```markdown
<!-- backgroundColor: #1a1a2e -->
<!-- backgroundImage: linear-gradient(to right, #0f2027, #203a43, #2c5364) -->
```

---

## Themes

### Built-in Themes

| Theme | Style |
|-------|-------|
| `default` | Clean, minimal |
| `gaia` | Bold colors, modern |
| `uncover` | Professional, subtle |

### Apply Theme

```yaml
---
marp: true
theme: gaia
---
```

### Class Modifiers (Theme-Specific)

```markdown
<!-- _class: lead -->          # Centered title slide
<!-- _class: invert -->        # Inverted colors
<!-- _class: lead invert -->   # Combine classes
```

---

## Content Overflow Prevention

**⚠️ CRITICAL: Slides will overflow if too much content. Follow these rules:**

| Rule | Limit |
|------|-------|
| Bullet points per slide | **Max 5** |
| Characters per bullet | **Max 60** |
| Nesting levels | **Max 2** |
| Words per slide | **Max 75** |
| Key message | **One per slide** |

### Bad Example (Will Overflow)

```markdown
# Too Much Content

- First point with a lot of explanation that goes on and on
- Second point with even more text and details nobody can read
- Third point continuing the pattern of overwhelming the audience
- Fourth point because we haven't learned our lesson yet
- Fifth point and there's still more to come
- Sixth point breaking all the rules
- Seventh point guaranteeing this slide will look terrible
```

### Good Example

```markdown
# Key Insight

- Users drop at checkout (40% abandonment)
- Payment step is the friction point
- Single CTA improved conversion 15%

---

# Details: Checkout Friction

- Guest checkout option missing
- 3 form fields → reduced to 1
- Progress indicator added
```

---

## Complete Example

```markdown
---
marp: true
theme: gaia
paginate: true
header: "Design Review"
footer: "Q4 2025"
---

<!-- _class: lead -->
<!-- _paginate: skip -->

# User Journey Analysis
## E-commerce Checkout Flow

---

# Key Finding

Users abandon at payment (40% drop-off)

![bg right:40%](checkout-flow.png)

---

## Stage 1: Discovery

- Browse products (😊 High satisfaction)
- Add to cart (😐 Medium friction)

---

## Stage 2: Checkout

- Enter payment (😟 Major friction point)
- Confirm order (😊 Relief/satisfaction)

---

<!-- _class: lead -->
<!-- _backgroundColor: #0288d1 -->
<!-- _color: white -->

# Recommendation

**Simplify payment to single step**

Expected impact: 15% conversion lift
```

---

## CLI Options Reference

| Option | Purpose |
|--------|---------|
| `-o, --output <file>` | Output file path |
| `-w, --watch` | Rebuild on file changes |
| `-s, --server` | Start preview server |
| `-p, --preview` | Open in browser |
| `--pdf` | Force PDF output |
| `--pptx` | Force PowerPoint output |
| `--html` | Force HTML output |
| `--theme <name/path>` | Custom theme |
| `--allow-local-files` | Allow local images in PDF |

---

_Source: [Marp](https://marp.app/), Marpit framework_
