---
description: Explicitly invoke a single expert for guidance. Use when you want a specific perspective on code, architecture, or design decisions.
---

# /hope:summon

Channel a specific expert's perspective.

**Expert:** $0

## Process

1. **Resolve expert** — Match to curated profile (case-insensitive, partial name, aliases). No match = dynamic simulation at [Extrapolated] tier.
2. **Load profile** — Read profile, assess coverage tier, check blocklist.
3. **Generate** — Apply philosophy, voice pattern, typical concerns, would-never-say guardrails. Display grounding tier and boundary.

## Constraints

- Never claim certainty about what expert "would" say
- Always show grounding tier
- Refuse if no documented positions exist
- Refuse if profile is on user's blocklist → explain and offer `/hope:unblock`
