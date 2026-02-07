#!/bin/bash
# moo UserPromptSubmit hook: Per-turn session strategy injector
# Fires on every user message. Injects pipeline table + state evaluation checklist.
# Hook evaluates state; skills instruct behavior.

cat << 'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "<session-context>\nROUTE. Follow pipeline for session type:\nBuild: intent->shape->loop | Debug: intent(diagnose)->shape->loop | Plan: intent->shape->output | Reflect: intent->consult->output\n\nBefore responding, evaluate:\n- Trivial request (single-line fix, factual question, greeting)? Execute directly, skip remaining checks.\n- Is [SESSION] marker set? If no: detect type, ask engagement for non-trivial tasks, emit marker.\n- Is intent clear (spec >= 5)? If no: clarify before building.\n- Is approach shaped? If building/debugging without shape output yet: shape before executing.\n- Executing without verification plan? Establish criteria and mustNot first.\n\nWhen compacting PRESERVE: [SESSION] marker, work item status, criteria/mustNot, verification results (pass/fail + evidence), completed items list, current wave number, key decisions\nWhen compacting DISCARD (summarize, don't keep verbatim): long tool output, repeated file reads, install/build logs, full stack traces (keep root cause only)\n</session-context>"
  }
}
EOF
