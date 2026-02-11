#!/bin/bash
# PreToolUse guard: blocks writes to references/ directories.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')

if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

if echo "$FILE_PATH" | grep -q '/references/'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "No references/ directories — flat files alongside SKILL.md only. Move this file to the skill directory root."
    }
  }'
fi
