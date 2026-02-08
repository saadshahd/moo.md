---
description: List all blocked profiles.
---

# /hope:blocked

Show your expert blocklist.

## Process

1. Read `~/.claude/counsel-blocklist.json`
2. Display table: Name | Reason | Blocked On
3. If empty or missing: "No blocked profiles." with `/hope:block` hint
4. If populated: show table with `/hope:unblock` hint
