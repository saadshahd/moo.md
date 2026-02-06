#!/bin/bash
# moo UserPromptSubmit hook: Per-turn session strategy injector
# Fires on every user message. Injects compact session strategy instructions.

cat << 'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "<session-context>\nApply hope:soul. Maintain session strategy:\n- If [SESSION] marker exists in conversation, continue with those settings\n- If no marker, detect type from user message and ask engagement for non-trivial tasks\n- Always emit [SESSION] Type: X | Engagement: Y after setting strategy\n- When compacting PRESERVE: [SESSION] marker, work item status, criteria/mustNot, verification results (pass/fail + evidence), completed items list, current wave number, key decisions\n- When compacting DISCARD (summarize, don't keep verbatim): long tool output, repeated file reads, install/build logs, full stack traces (keep root cause only)\n</session-context>"
  }
}
EOF
