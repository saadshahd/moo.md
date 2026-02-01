#!/bin/bash
#
# Deterministic stop decision for loop plugin.
# Returns JSON: {ok: true} to stop, {ok: false, reason: "..."} to continue.
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

# No state file = no active loop, allow stop
if [ ! -f "$STATE_FILE" ]; then
  echo '{"ok": true}'
  exit 0
fi

# Validate JSON - if invalid, allow stop
if ! jq empty "$STATE_FILE" 2>/dev/null; then
  echo '{"ok": true, "reason": "invalid state file"}'
  exit 0
fi

# Check status field
status=$(jq -r '.status // "active"' "$STATE_FILE" 2>/dev/null || echo "active")

case "$status" in
  "completed"|"cancelled")
    echo '{"ok": true}'
    exit 0
    ;;
esac

# Check circuit breaker first
stuck_count=$(jq -r '.circuitBreaker.stuckCount // 0' "$STATE_FILE" 2>/dev/null || echo "0")
if [ "$stuck_count" -ge 5 ] 2>/dev/null; then
  echo '{"ok": true, "reason": "circuit breaker triggered after 5 stuck iterations"}'
  exit 0
fi

# Dual-condition exit: ALL criteria must be true AND exit_signal must be true
# Handle both old format (value is boolean) and new format (value is {met, verification})
all_criteria_met=$(jq '[.criteriaStatus // {} | to_entries[] | .value | if type == "boolean" then . elif type == "object" then .met else false end] | if length == 0 then false else all end' "$STATE_FILE" 2>/dev/null || echo "false")

# Check for assumption-only verification (blocks exit)
has_assumption=$(jq '[.criteriaStatus // {} | to_entries[] | .value | if type == "object" then .verification else "execution output" end] | any(. == "assumption")' "$STATE_FILE" 2>/dev/null || echo "false")
if [ "$has_assumption" = "true" ] && [ "$all_criteria_met" = "true" ]; then
  echo '{"ok": false, "reason": "criterion verified by assumption only - requires actual verification"}'
  exit 0
fi
exit_signal=$(jq -r '.exit_signal // false' "$STATE_FILE" 2>/dev/null || echo "false")

if [ "$all_criteria_met" = "true" ] && [ "$exit_signal" = "true" ]; then
  echo '{"ok": true}'
  exit 0
fi

# Build continuation reason
if [ "$all_criteria_met" = "true" ] && [ "$exit_signal" = "false" ]; then
  echo '{"ok": false, "reason": "criteria met but exit_signal not set - verify completion"}'
  exit 0
fi

# List unmet criteria for continuation message (handle both old and new formats)
unmet=$(jq -r '[.criteriaStatus // {} | to_entries[] | select((.value | if type == "boolean" then . == false elif type == "object" then .met == false else true end)) | .key] | join(", ")' "$STATE_FILE" 2>/dev/null || echo "unknown")
if [ -z "$unmet" ]; then
  unmet="unknown"
fi

echo "{\"ok\": false, \"reason\": \"unmet criteria: ${unmet}\"}"
exit 0
