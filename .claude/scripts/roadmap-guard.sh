#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')

[[ -z "$FILE_PATH" ]] && exit 0

if [[ "$(basename "$FILE_PATH")" != "ROADMAP.md" ]]; then
  exit 0
fi

[[ -f "$FILE_PATH" ]] || exit 0

WARNINGS=""

LINE_COUNT=$(wc -l < "$FILE_PATH" | tr -d ' ')
if [[ "$LINE_COUNT" -gt 100 ]]; then
  WARNINGS="ROADMAP.md is ${LINE_COUNT} lines (max 100). Trim it down."
fi

LONG_LINES=$(awk 'length > 120 { count++ } END { print count+0 }' "$FILE_PATH")
if [[ "$LONG_LINES" -gt 0 ]]; then
  if [[ -n "$WARNINGS" ]]; then
    WARNINGS="${WARNINGS} Also: ${LONG_LINES} lines exceed 120 chars."
  else
    WARNINGS="${LONG_LINES} lines in ROADMAP.md exceed 120 chars max."
  fi
fi

if [[ -n "$WARNINGS" ]]; then
  jq -n --arg warn "WARNING: $WARNINGS" '{
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: $warn
    }
  }'
fi

exit 0
