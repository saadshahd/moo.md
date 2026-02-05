#!/bin/bash
#
# Deterministic stop decision for loop plugin.
# Returns JSON: {ok: true} to stop, {ok: false, reason: "..."} to continue.

INPUT=$(cat)

# Prevent infinite loops
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active // false')" = "true" ]; then
  echo '{"ok": true}'
  exit 0
fi

# Basic schema validation for state file
STATE_FILE=".loop/workflow-state.json"
if [ -f "$STATE_FILE" ]; then
  if ! jq -e '.version and .stage and .task' "$STATE_FILE" > /dev/null 2>&1; then
    echo '{"ok": true, "reason": "Invalid state schema"}'
    exit 0
  fi
fi

# TaskList-based detection
TASK_LIST_ID="${CLAUDE_CODE_TASK_LIST_ID:-}"
if [ -n "$TASK_LIST_ID" ]; then
  TASK_DIR="$HOME/.claude/tasks/$TASK_LIST_ID"
  if [ -d "$TASK_DIR" ]; then
    PENDING=$(find "$TASK_DIR" -name "*.json" -exec jq -r 'select(.status == "pending" or .status == "in_progress") | .subject' {} \; 2>/dev/null | head -3)

    if [ -z "$PENDING" ]; then
      echo '{"ok": true}'
    else
      PENDING_ESCAPED=$(echo "$PENDING" | tr '\n' ',' | sed 's/,$//')
      echo "{\"ok\": false, \"reason\": \"pending tasks: ${PENDING_ESCAPED}\"}"
    fi
    exit 0
  fi
fi

# No task list = allow stop
echo '{"ok": true}'
exit 0
