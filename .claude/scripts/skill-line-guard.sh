#!/bin/bash
# PostToolUse guard: warns when a SKILL.md exceeds 200 lines or references/ is created.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')

if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

if echo "$FILE_PATH" | grep -q '/references/'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: "WARNING: You just wrote to a references/ directory. This is an anti-pattern — use flat files alongside SKILL.md instead. Delete the file and move its content."
    }
  }'
  exit 0
fi

if echo "$FILE_PATH" | grep -q 'SKILL\.md$'; then
  if [[ -f "$FILE_PATH" ]]; then
    LINES=$(wc -l < "$FILE_PATH" | tr -d ' ')
    if [[ "$LINES" -gt 200 ]]; then
      jq -n --arg lines "$LINES" '{
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: ("WARNING: SKILL.md is " + $lines + " lines (max 200). Trim before committing — the pre-push hook will reject this.")
        }
      }'
      exit 0
    fi
  fi
fi

exit 0
