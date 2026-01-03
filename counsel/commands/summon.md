---
description: Explicitly invoke a single expert for guidance. Use when you want a specific perspective on code, architecture, or design decisions.
---

# /counsel:summon

Channel a specific expert's perspective.

## Usage

```
/counsel:summon addy osmani
/counsel:summon "Rich Hickey" for this data model
/counsel:summon kyle simpson — explain closures
```

## Inputs

- `$1` — Expert name (required)
- `$2+` — Context or question (optional, uses conversation context if omitted)

## Process

1. **Resolve expert** — Match to curated profile (case-insensitive, partial name, aliases). No match = dynamic simulation at 4/10.
2. **Load profile** — Read profile, calculate confidence per [confidence.md](../skills/counsel/references/confidence.md), check calibrations.
3. **Generate** — Apply philosophy, voice pattern, typical concerns, would-never-say guardrails. Display confidence, offer calibration.

## Constraints

- Never claim certainty about what expert "would" say
- Always show confidence rating
- Always offer calibration option
- Refuse if confidence would be < 3/10
- Refuse if profile is on user's blocklist → explain and offer `/counsel:unblock`
