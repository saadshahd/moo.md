#!/bin/sh
# UserPromptSubmit: correction capture. When the user's prompt reads as a correction, inject a
# capture nudge (additionalContext) so the foreground — which holds the full conversational
# nuance — records the durable lesson in-context. This fires BEFORE the turn, so it never blocks
# or re-engages the thread. Stop-time capture is deliberately handled off-thread by
# memory-write.sh instead (a Stop nudge would force another turn). The nudge mandates silent
# operation: no memory commentary unless a file is actually written. Fails open on missing input.
command -v jq >/dev/null 2>&1 || exit 0
input=$(cat)
prompt=$(printf '%s' "$input" | jq -r '.prompt // empty')

# Correction is signal — a correction is almost always a durable lesson.
printf '%s' "$prompt" | grep -qiE "actually|that'?s (wrong|not right|incorrect)|no,|not what i|instead|revert|undo|misunderstood|i (said|told you)|stop doing" || exit 0

jq -n --arg c "Memory moment: the user is correcting you. Apply the auto-memory discipline — if it qualifies, record the durable lesson (what failed, the corrected direction) to MEMORY.md. Work silently in the background: say nothing about memory unless you actually write a file, then one concise line only." \
  '{hookSpecificOutput:{hookEventName:"UserPromptSubmit", additionalContext:$c}}'
exit 0
