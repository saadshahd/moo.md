---
description: Export design decisions as W3C DTCG design tokens JSON. Import into Figma (Tokens Studio) or Penpot.
---

# /tokens

Export design system decisions as W3C DTCG-compliant design tokens JSON.

## Input

$0

Context from directions or system workflow, or explicit token request.

## Process

### 1. Determine Content Source

- If in system workflow context, use those outputs
- If in directions workflow, extract color/type decisions
- If arguments specify tokens, use that
- If unclear, ask: "What design decisions should I convert to tokens?"

### 2. Generate DTCG JSON

Follow [W3C Design Tokens Community Group format](https://design-tokens.github.io/community-group/format/).

**Required structure:**
```json
{
  "$schema": "https://design-tokens.org/schema.json",
  "color": { ... },
  "typography": { ... },
  "spacing": { ... }
}
```

### 3. Write Output File

```bash
mkdir -p tokens
```

Use Write tool to create `tokens/design-tokens.json`

### 4. Provide Import Instructions

**Figma (via Tokens Studio):**
1. Install [Tokens Studio](https://tokens.studio/) plugin
2. Open plugin → Settings → Add new → JSON
3. Paste or import the tokens file
4. Apply tokens to your design

**Penpot:**
1. Penpot has native DTCG support
2. Import tokens directly in Design Tokens panel

**Code (via Style Dictionary):**
```bash
npm install -g style-dictionary
style-dictionary build
```

## Token Categories

### Color Tokens

```json
{
  "color": {
    "primary": {
      "$type": "color",
      "$value": "#0066FF",
      "$description": "Primary brand color"
    },
    "primary-hover": {
      "$type": "color",
      "$value": "#0052CC"
    },
    "secondary": {
      "$type": "color",
      "$value": "#6B7280"
    },
    "background": {
      "$type": "color",
      "$value": "#FFFFFF"
    },
    "surface": {
      "$type": "color",
      "$value": "#F9FAFB"
    },
    "text": {
      "$type": "color",
      "$value": "#111827"
    },
    "text-muted": {
      "$type": "color",
      "$value": "#6B7280"
    },
    "error": {
      "$type": "color",
      "$value": "#DC2626"
    },
    "success": {
      "$type": "color",
      "$value": "#16A34A"
    }
  }
}
```

### Typography Tokens

```json
{
  "typography": {
    "font-family": {
      "base": {
        "$type": "fontFamily",
        "$value": "Inter, system-ui, sans-serif"
      },
      "heading": {
        "$type": "fontFamily",
        "$value": "Inter, system-ui, sans-serif"
      },
      "mono": {
        "$type": "fontFamily",
        "$value": "JetBrains Mono, monospace"
      }
    },
    "font-size": {
      "xs": { "$type": "dimension", "$value": "12px" },
      "sm": { "$type": "dimension", "$value": "14px" },
      "base": { "$type": "dimension", "$value": "16px" },
      "lg": { "$type": "dimension", "$value": "18px" },
      "xl": { "$type": "dimension", "$value": "20px" },
      "2xl": { "$type": "dimension", "$value": "24px" },
      "3xl": { "$type": "dimension", "$value": "30px" },
      "4xl": { "$type": "dimension", "$value": "36px" }
    },
    "font-weight": {
      "normal": { "$type": "fontWeight", "$value": 400 },
      "medium": { "$type": "fontWeight", "$value": 500 },
      "semibold": { "$type": "fontWeight", "$value": 600 },
      "bold": { "$type": "fontWeight", "$value": 700 }
    },
    "line-height": {
      "tight": { "$type": "number", "$value": 1.25 },
      "normal": { "$type": "number", "$value": 1.5 },
      "relaxed": { "$type": "number", "$value": 1.75 }
    }
  }
}
```

### Spacing Tokens

```json
{
  "spacing": {
    "0": { "$type": "dimension", "$value": "0px" },
    "1": { "$type": "dimension", "$value": "4px" },
    "2": { "$type": "dimension", "$value": "8px" },
    "3": { "$type": "dimension", "$value": "12px" },
    "4": { "$type": "dimension", "$value": "16px" },
    "5": { "$type": "dimension", "$value": "20px" },
    "6": { "$type": "dimension", "$value": "24px" },
    "8": { "$type": "dimension", "$value": "32px" },
    "10": { "$type": "dimension", "$value": "40px" },
    "12": { "$type": "dimension", "$value": "48px" },
    "16": { "$type": "dimension", "$value": "64px" }
  }
}
```

### Border Tokens

```json
{
  "border": {
    "radius": {
      "none": { "$type": "dimension", "$value": "0px" },
      "sm": { "$type": "dimension", "$value": "4px" },
      "md": { "$type": "dimension", "$value": "8px" },
      "lg": { "$type": "dimension", "$value": "12px" },
      "full": { "$type": "dimension", "$value": "9999px" }
    },
    "width": {
      "thin": { "$type": "dimension", "$value": "1px" },
      "medium": { "$type": "dimension", "$value": "2px" }
    }
  }
}
```

### Shadow Tokens

```json
{
  "shadow": {
    "sm": {
      "$type": "shadow",
      "$value": {
        "color": "#0000001a",
        "offsetX": "0px",
        "offsetY": "1px",
        "blur": "2px",
        "spread": "0px"
      }
    },
    "md": {
      "$type": "shadow",
      "$value": {
        "color": "#0000001a",
        "offsetX": "0px",
        "offsetY": "4px",
        "blur": "6px",
        "spread": "-1px"
      }
    },
    "lg": {
      "$type": "shadow",
      "$value": {
        "color": "#0000001a",
        "offsetX": "0px",
        "offsetY": "10px",
        "blur": "15px",
        "spread": "-3px"
      }
    }
  }
}
```

## Complete Example

From a design system workflow:

```json
{
  "$schema": "https://design-tokens.org/schema.json",
  "color": {
    "primary": { "$type": "color", "$value": "#0066FF" },
    "primary-hover": { "$type": "color", "$value": "#0052CC" },
    "secondary": { "$type": "color", "$value": "#6B7280" },
    "background": { "$type": "color", "$value": "#FFFFFF" },
    "surface": { "$type": "color", "$value": "#F9FAFB" },
    "text": { "$type": "color", "$value": "#111827" },
    "text-muted": { "$type": "color", "$value": "#6B7280" },
    "error": { "$type": "color", "$value": "#DC2626" },
    "success": { "$type": "color", "$value": "#16A34A" }
  },
  "typography": {
    "font-family": {
      "base": { "$type": "fontFamily", "$value": "Inter, sans-serif" }
    },
    "font-size": {
      "base": { "$type": "dimension", "$value": "16px" },
      "lg": { "$type": "dimension", "$value": "18px" },
      "xl": { "$type": "dimension", "$value": "20px" }
    }
  },
  "spacing": {
    "4": { "$type": "dimension", "$value": "16px" },
    "6": { "$type": "dimension", "$value": "24px" },
    "8": { "$type": "dimension", "$value": "32px" }
  },
  "border": {
    "radius": {
      "md": { "$type": "dimension", "$value": "8px" }
    }
  }
}
```

## Related

- [Design System Workflow](../skills/design/references/system.md)
- [Figma AI Prompt Command](figma-prompt.md)
