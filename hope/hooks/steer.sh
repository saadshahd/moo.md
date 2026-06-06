#!/bin/sh
# Deny-once latch: first Workflow call per session delivers the review protocol (exit 2),
# every later call passes silently (exit 0). Marker creation failure fails open — a broken
# tmp dir must never brick the Workflow tool.
session=$(grep -o '"session_id":"[^"]*"' | head -n1 | cut -d'"' -f4)
marker="${TMPDIR:-/tmp}/hope-steer-${session:-nosession}"
[ -f "$marker" ] && exit 0
: > "$marker" 2>/dev/null || exit 0
cat "$(dirname "$0")/steer.md" >&2
exit 2
