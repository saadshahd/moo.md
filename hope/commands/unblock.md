---
description: Remove a profile from expert blocklist.
---

# /hope:unblock

Remove a profile from your blocklist.

**Profile:** $0

## Process

1. Read `~/.claude/counsel-blocklist.json`
2. Find and remove matching entry by name
3. Write back to file
4. Confirm removal or report not found with `/hope:blocked` hint

## Constraints

- Case-insensitive name matching
- No-op if profile not blocked
