---
description: Block a profile from all counsel simulations.
---

# /counsel:block

Block a profile from counsel simulations.

## Usage

```
/counsel:block pocock
/counsel:block pocock --reason "prefer deeper expertise"
```

## Inputs

- `$1` — Profile name to block (required, case-insensitive)
- `--reason` — Optional reason for blocking

## Process

1. Read `~/.claude/counsel-blocklist.json` (create if missing)
2. Check if profile already blocked → skip if exists
3. Add entry: `{name, reason, blockedAt}`
4. Write back to file
5. Confirm: "[profile] blocked from counsel simulations."

## Output

```
✓ pocock blocked from counsel simulations.

This profile will be excluded from:
- Auto-detection and inference
- Panel selection
- Explicit summoning

Use /counsel:blocked to view your blocklist.
Use /counsel:unblock pocock to remove.
```

## Constraints

- Blocks both curated profiles and dynamic simulation attempts
- Partial name matching (e.g., "pocock" blocks "matt pocock")
- User-global scope only (`~/.claude/`)
