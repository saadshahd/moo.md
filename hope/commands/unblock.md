---
description: Remove a profile from expert blocklist.
---

# /hope:unblock

Remove a profile from your blocklist.

## Usage

```
/hope:unblock pocock
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
[name] unblocked. This profile is now available for expert simulations.
```

If not found:

```
[name] is not on your blocklist. Use /hope:blocked to view current blocklist.
```

## Constraints

- Case-insensitive name matching
- No-op if profile not blocked
