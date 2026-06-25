#!/bin/sh
# Stop / SubagentStop: off-record slop-awareness judge. The transcript is used ONLY to select
# which files this chunk touched (Edit/Write/MultiEdit tool_use since the last stop); the judge
# then reads those files LIVE and judges them in full against loaded preferences. Transcript =
# selection, filesystem = truth — so frozen, possibly-superseded edit fragments are never judged,
# and the bar is "leave each touched file better than before," not just "grade the diff."
# A hooks-disabled headless `claude -p` loads its own CLAUDE.md / TASTE.md from the project —
# those discovered instructions ARE the preferences it judges against. hope ships NO taste.
#
# Registered asyncRewake — Claude Code never waits, so the foreground turn ends with no
# interruption. The judge runs detached; exit 2 wakes Claude with an advisory nudge on stderr,
# exit 0 stays silent. Never blocks, never gates, persists nothing.
#
# Recursion guard: the judge runs with --settings disableAllHooks so its own Stop can never
# re-fire this hook. Read-only allowlist + bypassPermissions so a no-TTY permission prompt can
# never hang. Fails open at every step — a missing tool, file, or transcript must never stall a
# session.
command -v jq >/dev/null 2>&1 || exit 0
command -v claude >/dev/null 2>&1 || exit 0

input=$(cat)
tp=$(printf '%s' "$input" | jq -r '.transcript_path // empty')
[ -f "$tp" ] || exit 0

# Per-transcript offset marker, keyed by the transcript basename. SubagentStop is handed the MAIN
# session transcript (not a separate subagent file), so Stop and SubagentStop on one session share
# this single monotonic offset — cooperative, not conflicting: each stop judges only the lines
# appended since the last, whichever event fired. Stores the line count already judged; the chunk
# is everything after it. Advancing it every stop makes the judge idempotent — no prior stop is
# ever re-judged.
tpkey=$(basename "$tp" | sed 's/[^A-Za-z0-9]/_/g')
marker="${TMPDIR:-/tmp}/hope-slop-$tpkey"
offset=$(cat "$marker" 2>/dev/null)
case "$offset" in ''|*[!0-9]*) offset=0 ;; esac

total=$(wc -l < "$tp" 2>/dev/null | tr -d ' ')
case "$total" in ''|*[!0-9]*) exit 0 ;; esac
[ "$total" -le "$offset" ] && exit 0

# The transcript's ONLY job is selection: which files this chunk touched. The new side of each
# edit is deliberately NOT extracted — those are frozen, possibly-superseded fragments. The judge
# reads the LIVE files instead, so it judges what the code actually says now.
files=$(tail -n +$((offset + 1)) "$tp" | jq -r '
  select(.type=="assistant")
  | .message.content[]?
  | select(.type=="tool_use" and (.name=="Edit" or .name=="Write" or .name=="MultiEdit"))
  | .input.file_path // empty' 2>/dev/null | sort -u)

# Offset advances regardless of outcome — this chunk is now accounted for, judged or not.
printf '%s' "$total" > "$marker" 2>/dev/null

# Keep only paths that still exist live (a written-then-deleted file leaves no ghost to judge).
live=$(printf '%s\n' "$files" | while IFS= read -r f; do [ -n "$f" ] && [ -f "$f" ] && printf '%s\n' "$f"; done)

# No live file touched this chunk → nothing to judge. The natural gate: pure Q&A / planning turns
# (and pure-deletion turns) never spawn the judge.
[ -z "$live" ] && exit 0

prompt=$(printf 'You are moo'\''s off-record slop-awareness judge — a background check, not addressing a human. Your loaded instructions (the CLAUDE.md / TASTE.md hierarchy and any conventions discovered in this directory) are the ONLY preferences you judge against; you ship no taste of your own. These files were touched this turn:\n%s\nRead each one IN FULL — it is the live, current code, so judge what it actually says now, not any earlier version. Flag any violation that PLAINLY breaks a preference EXPLICITLY present in your loaded instructions — duplication of something that already exists, a banned pattern, a broken naming or structure rule — ANYWHERE in these files, not only the lines that changed: a touched file should be left better than before, so a pre-existing violation in it counts too. Be conservative: flag only clear, nameable violations; when in doubt, stay silent. If nothing qualifies, print exactly CLEAN and nothing else. Otherwise print up to 5 lines, most important first, each formatted "- <file>: <the violated preference> — <what to look at>". No preamble, no commentary.' \
  "$live")

# Read-only tools only; --allowed-tools is variadic so values are space-separated and `--`
# terminates the flag. bypassPermissions prevents a no-TTY prompt from hanging (the allowlist
# already bars writes). disableAllHooks is the recursion guard. Errors go to a per-transcript
# log, never /dev/null, so a silent breakage stays diagnosable off-thread.
finding=$(claude -p --no-session-persistence --settings '{"disableAllHooks":true}' \
  --permission-mode bypassPermissions --allowed-tools Read Grep Glob -- "$prompt" \
  2>"${TMPDIR:-/tmp}/hope-slop-judge-$tpkey.log")

# Clean (empty or the CLEAN sentinel) → silent exit 0, no wake, no forced turn.
[ -z "$finding" ] && exit 0
printf '%s' "$finding" | head -n1 | grep -q '^CLEAN' && exit 0

# Finding → wake Claude with an advisory nudge on stderr (exit 2). Advisory only: it names the
# violation and explicitly does not block.
{
  echo "Slop-awareness nudge (advisory — does not block). A file you touched this turn may break a loaded preference (leave it better than before):"
  printf '%s\n' "$finding"
  echo "Decide whether to fix now or leave it; ignore if this is a false positive."
} >&2
exit 2
