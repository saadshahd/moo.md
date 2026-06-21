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
    "additionalContext": "Verified subagent work returned. If this diff embodies a decision (recoverability test), run the RETURN act before surfacing — have the human author a re-answerable prompt and append it to the own ledger as an authored event. Mechanical diffs skip."
  }
}
JSON
exit 0
