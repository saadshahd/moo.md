---
description: List all blocked profiles.
---

# /hope:blocked

Show your expert blocklist.

## Usage

```
/hope:blocked
```

## Output

If blocklist exists:

```
## Blocked Profiles

| Name | Reason | Blocked On |
|------|--------|------------|
| pocock | Shallow recommendations | 2026-01-03 |

Use /hope:unblock [name] to remove entries.
```

If no blocklist or empty:

```
No blocked profiles.

Use /hope:block [name] to block a profile.
```

## Process

1. Read `~/.claude/counsel-blocklist.json`
2. Display table of blocked profiles
3. Offer unblock command
