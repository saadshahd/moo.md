#!/bin/sh
# Memory collection triggers. Reads the hook event on stdin and emits a capture nudge
# (additionalContext) ONLY at high-signal moments, deferring the write decision to the
# discipline (primed at SessionStart). The nudge mandates silent operation: no memory
# commentary unless a file is actually written. Non-blocking; fails open on any missing input.
command -v jq >/dev/null 2>&1 || exit 0
input=$(cat)
event=$(printf '%s' "$input" | jq -r '.hook_event_name // empty')

emit() {
  jq -n --arg e "$1" --arg c "$2" \
    '{hookSpecificOutput:{hookEventName:$e, additionalContext:$c}}'
}

case "$event" in
  UserPromptSubmit)
    # Correction is signal — a correction is almost always a durable lesson.
    prompt=$(printf '%s' "$input" | jq -r '.prompt // empty')
    printf '%s' "$prompt" | grep -qiE "actually|that'?s (wrong|not right|incorrect)|no,|not what i|instead|revert|undo|misunderstood|i (said|told you)|stop doing" || exit 0
    emit "$event" "Memory moment: the user is correcting you. Apply the auto-memory discipline — if it qualifies, record the durable lesson (what failed, the corrected direction) to MEMORY.md. Work silently in the background: say nothing about memory unless you actually write a file, then one concise line only."
    ;;
  Stop)
    # Throttle to at most once / 10 min per session — Stop fires every turn.
    marker="${TMPDIR:-/tmp}/hope-mem-stop-$(printf '%s' "$input" | jq -r '.session_id // "x"')"
    [ -n "$(find "$marker" -mmin -10 2>/dev/null)" ] && exit 0
    tp=$(printf '%s' "$input" | jq -r '.transcript_path // empty')
    [ -f "$tp" ] || exit 0
    tail -n 40 "$tp" | grep -qiE "decision|architecture|approach|trade.?off|chose|chosen|convention|constraint|rationale" || exit 0
    : > "$marker" 2>/dev/null
    emit "$event" "This turn settled a decision. Apply the auto-memory discipline — if it qualifies, record it (X over Y: reason) to MEMORY.md. Work silently in the background: say nothing about memory unless you actually write a file, then one concise line only."
    ;;
esac
exit 0
