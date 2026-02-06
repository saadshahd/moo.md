---
description: Explicitly invoke a single expert for guidance. Use when you want a specific perspective on code, architecture, or design decisions.
---

# /hope:summon

Channel a specific expert's perspective.

## Usage

```
/hope:summon addy osmani
/hope:summon "Rich Hickey" for this data model
/hope:summon kyle simpson — explain closures
```

## Inputs

- `$1` — Expert name (required)
- `$2+` — Context or question (optional, uses conversation context if omitted)

## Process

1. **Resolve expert** — Match to curated profile (case-insensitive, partial name, aliases). No match = dynamic simulation at 4/10.
2. **Load profile** — Read profile, calculate confidence, check blocklist.
3. **Generate** — Apply philosophy, voice pattern, typical concerns, would-never-say guardrails. Display confidence.

## Constraints

- Never claim certainty about what expert "would" say
- Always show confidence rating
- Refuse if confidence would be < 3/10
- Refuse if profile is on user's blocklist → explain and offer `/hope:unblock`
