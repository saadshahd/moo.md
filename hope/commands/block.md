---
description: Block a profile from all expert simulations.
argument-hint: "profile name [--reason 'why']"
---

# /hope:block

Block a profile from expert simulations.

**Profile:** $0

## Process

1. Read `~/.claude/counsel-blocklist.json` (create if missing)
2. Check if profile already blocked → skip if exists
3. Add entry: `{name, reason, blockedAt}` (parse `--reason` from input if present)
4. Write back to file
5. Confirm with exclusion scope (auto-detection, panels, summoning) and unblock hint

## Constraints

- Blocks both curated profiles and dynamic simulation attempts
- Partial name matching (e.g., "pocock" blocks "matt pocock")
- User-global scope only (`~/.claude/`)
