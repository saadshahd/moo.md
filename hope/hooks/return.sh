#!/bin/sh
# Return nudge: after a subagent or workflow returns, remind the router to run
# the RETURN act on a decision-bearing diff before surfacing it. Reinforcement
# ONLY — a hook cannot author or capture; it injects one suppressed line of
# context (see delegate RETURN). Fails open: any error must never brick the
# Agent/Workflow tool, so always exit 0 with valid JSON.
cat <<'JSON'
{
  "suppressOutput": true,
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "Subagent work returned. The moment work returns is the moment the human claims it — run hope's handover act before surfacing."
  }
}
JSON
exit 0
