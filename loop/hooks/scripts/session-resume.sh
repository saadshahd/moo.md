#!/bin/bash
#
# Detect and announce active loop on session start.
# Returns JSON: {ok: true, message: "..."} with resume announcement if active loop found.
#
# CRITICAL: Must ALWAYS output valid JSON, never exit with error.

# Parse cwd from $ARGUMENTS JSON (passed by Claude Code)
CWD="."
if [ -n "${ARGUMENTS:-}" ]; then
  parsed_cwd=$(echo "$ARGUMENTS" | jq -r '.cwd // empty' 2>/dev/null)
  if [ -n "$parsed_cwd" ]; then
    CWD="$parsed_cwd"
  fi
fi

STATE_FILE="${CWD}/.loop/state.json"

# No state file = no active loop
if [ ! -f "$STATE_FILE" ]; then
  echo '{"ok": true, "message": ""}'
  exit 0
fi

# Validate JSON
if ! jq empty "$STATE_FILE" 2>/dev/null; then
  echo '{"ok": true, "message": ""}'
  exit 0
fi

# Check status
status=$(jq -r '.status // "active"' "$STATE_FILE" 2>/dev/null || echo "active")

case "$status" in
  "completed"|"cancelled")
    echo '{"ok": true, "message": ""}'
    exit 0
    ;;
esac

# Active loop found - build resume announcement
spec=$(jq -r '.spec // "unknown"' "$STATE_FILE" 2>/dev/null | head -c 100 || echo "unknown")
iteration=$(jq -r '.iteration // 1' "$STATE_FILE" 2>/dev/null || echo "1")
completed_count=$(jq -r '[.completedSteps // [] | length] | .[0]' "$STATE_FILE" 2>/dev/null || echo "0")
total_steps=$(jq -r '[.steps // [] | length] | .[0]' "$STATE_FILE" 2>/dev/null || echo "0")
unmet=$(jq -r '[.criteriaStatus // {} | to_entries[] | select(.value == false) | .key] | join(", ")' "$STATE_FILE" 2>/dev/null || echo "unknown")
next_step=$(jq -r '.remainingSteps[0] // "continue work"' "$STATE_FILE" 2>/dev/null || echo "continue work")

# Build message
message="[LOOP RESUME] Active loop detected
Spec: ${spec}
Progress: ${completed_count}/${total_steps} steps | Iteration: ${iteration}
Unmet criteria: ${unmet:-none}
Next: ${next_step}"

# Escape for JSON using jq
escaped_message=$(echo "$message" | jq -Rs '.' 2>/dev/null || echo '"[LOOP RESUME] Active loop detected"')

echo "{\"ok\": true, \"message\": ${escaped_message}}"
exit 0
