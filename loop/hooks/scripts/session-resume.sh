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

STATE_FILE="${CWD}/.loop/workflow-state.json"

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

# Check stage
stage=$(jq -r '.stage // "executing"' "$STATE_FILE" 2>/dev/null || echo "executing")

case "$stage" in
  "complete"|"cancelled")
    echo '{"ok": true, "message": ""}'
    exit 0
    ;;
esac

# Active loop found - build resume announcement
task=$(jq -r '.task // "unknown"' "$STATE_FILE" 2>/dev/null | head -c 100 || echo "unknown")
spec_score=$(jq -r '.spec_score // "?"' "$STATE_FILE" 2>/dev/null || echo "?")
fit_score=$(jq -r '.fit_score // "?"' "$STATE_FILE" 2>/dev/null || echo "?")
shape=$(jq -r '.shape_chosen // "unknown"' "$STATE_FILE" 2>/dev/null || echo "unknown")

# Build message based on stage
case "$stage" in
  "planning")
    message="[LOOP RESUME] Plan created but not yet executed
Task: ${task}
Stage: planning | Shape: ${shape}
Spec: ${spec_score}/10 | Fit: ${fit_score}
A plan was created for this loop. Run /loop:start to execute it or /loop:cancel to discard."
    ;;
  *)
    message="[LOOP RESUME] Active loop detected
Task: ${task}
Stage: ${stage} | Shape: ${shape}
Spec: ${spec_score}/10 | Fit: ${fit_score}
Run /loop:start to resume or /loop:cancel to clear."
    ;;
esac

# Escape for JSON using jq
escaped_message=$(echo "$message" | jq -Rs '.' 2>/dev/null || echo '"[LOOP RESUME] Active loop detected"')

echo "{\"ok\": true, \"message\": ${escaped_message}}"
exit 0
