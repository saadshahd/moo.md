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
    "additionalContext": "Verified subagent work returned. Run the handover test before surfacing: probe ONLY if it carries a load-bearing decision AND the work diverged from what was asked (inverted/exceeded it, or the human doesn't hold the model). If several qualify, probe just the highest-blast-radius one — one forward question built from the work + the human's own words, they answer, you reframe once. Nothing stored. Quiet by default; most returns skip."
  }
}
JSON
exit 0
