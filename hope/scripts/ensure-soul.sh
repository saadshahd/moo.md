#!/bin/bash
# moo UserPromptSubmit hook: Backup reminder for soul skill
# Only fires on first few messages to ensure soul is applied

INPUT=$(cat)
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path')

# Count existing messages - only inject reminder early in session
MSG_COUNT=$(jq -s 'length' < "$TRANSCRIPT_PATH" 2>/dev/null || echo 0)

if [ "$MSG_COUNT" -lt 3 ]; then
  cat << 'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "REMEMBER: Apply hope:soul skill - run Silent Audit before responding."
  }
}
EOF
fi
