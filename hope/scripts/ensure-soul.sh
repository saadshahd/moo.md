#!/bin/bash
# moo UserPromptSubmit hook: Per-turn session strategy injector
# Fires on every user message. Injects compact session strategy instructions.

cat << 'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "<session-context>\nApply hope:soul. Maintain session strategy:\n- If [SESSION] marker exists in conversation, continue with those settings\n- If no marker, detect type from user message and ask engagement for non-trivial tasks\n- Always emit [SESSION] Type: X | Engagement: Y after setting strategy\n- When compacting, preserve the [SESSION] marker in summary\n</session-context>"
  }
}
EOF
