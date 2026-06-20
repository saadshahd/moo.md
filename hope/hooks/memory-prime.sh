#!/bin/sh
# SessionStart: inject moo's auto-memory discipline so Claude curates durable memory,
# not random memory. Fails open — a missing file or absent jq must never block a session.
doc="$(dirname "$0")/../skills/memory.md"
[ -f "$doc" ] || exit 0
command -v jq >/dev/null 2>&1 || exit 0
jq -Rs '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:.}}' < "$doc"
exit 0
