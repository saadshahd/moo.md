---
description: Remove a profile from counsel blocklist.
---

# /counsel:unblock

Remove a profile from your blocklist.

## Usage

```
/counsel:unblock pocock
```

## Inputs

- `$1` — Profile name to unblock (required, case-insensitive)

## Process

1. Read `~/.claude/counsel-blocklist.json`
2. Find and remove matching entry by name
3. Write back to file
4. Confirm removal

## Output

```
✓ pocock unblocked.

This profile is now available for counsel simulations.
```

If not found:

```
⚠️ pocock is not on your blocklist.

Use /counsel:blocked to view current blocklist.
```

## Constraints

- Case-insensitive name matching
- No-op if profile not blocked
