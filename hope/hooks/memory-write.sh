#!/bin/sh
# Stop: detached memory writer. Extracts a focused slice of recent dialogue (user/assistant text
# only — tool calls and results stripped) and hands it to a hooks-disabled headless `claude -p`
# that applies the auto-memory discipline and, only if a durable fact qualifies, updates MEMORY.md.
# Registered async — Claude Code never waits, so the foreground turn ends with no context
# injection and no re-engagement. The write happens silently in the background; it surfaces only
# as an ordinary file change (visible in git), never as a thread interruption.
#
# Recursion guard: the headless writer runs with --settings disableAllHooks so its own Stop can
# never re-fire this hook. --bare is deliberately NOT used (it requires ANTHROPIC_API_KEY and is
# unusable on a Claude Max/Pro subscription). Fails open at every step — a missing tool, file, or
# memory dir must never block the session.
command -v jq >/dev/null 2>&1 || exit 0
command -v claude >/dev/null 2>&1 || exit 0
# The writer is told to read the discipline from this path — if it isn't locatable, don't spawn.
discipline="$CLAUDE_PLUGIN_ROOT/skills/memory.md"
[ -f "$discipline" ] || exit 0
input=$(cat)
session=$(printf '%s' "$input" | jq -r '.session_id // "x"')

# Throttle: at most once / 10 min per session — Stop fires every turn.
marker="${TMPDIR:-/tmp}/hope-mem-stop-$session"
[ -n "$(find "$marker" -mmin -10 2>/dev/null)" ] && exit 0

tp=$(printf '%s' "$input" | jq -r '.transcript_path // empty')
[ -f "$tp" ] || exit 0

# Focused slice: recent user/assistant text turns, tool noise removed. content is a bare string
# or an array of typed blocks; keep only text.
slice=$(tail -n 80 "$tp" | jq -r '
  select(.type=="user" or .type=="assistant")
  | (.message.content) as $c
  | if ($c|type)=="string" then $c
    elif ($c|type)=="array" then ($c[] | select(.type=="text") | .text)
    else empty end' 2>/dev/null | tail -n 200)

# Decision-signal gate — only spawn the writer when the slice likely settled something durable.
printf '%s' "$slice" | grep -qiE "decision|architecture|approach|trade.?off|chose|chosen|convention|constraint|rationale" || exit 0

# Auto-memory lives outside the repo at ~/.claude/projects/<slug>/memory/ — slug is the cwd with
# / and . replaced by -. Computed explicitly because disableAllHooks skips the writer's
# SessionStart, so native auto-memory load cannot be assumed. A wrong slug fails the guard below
# and the turn is simply skipped (a missed capture is recoverable; a corrupt write is not).
slug=$(printf '%s' "${CLAUDE_PROJECT_DIR:-$PWD}" | sed 's#[/.]#-#g')
memdir="$HOME/.claude/projects/$slug/memory"
[ -d "$memdir" ] || exit 0

: > "$marker" 2>/dev/null
slicefile="${TMPDIR:-/tmp}/hope-mem-slice-$session"
printf '%s' "$slice" > "$slicefile"

prompt=$(printf 'You are moo'\''s detached memory writer — a background session, not addressing a human. Read the auto-memory discipline at %s and follow it exactly, including its naming & indexing rule. Read the recent conversation slice at %s (most relevant at the end). If and ONLY if a durable fact qualifies, record it under %s/: first scan the index %s/MEMORY.md; if an existing entry'\''s slug or scope already covers the fact, READ that file and edit it IN PLACE; create a new file ONLY after confirming from the index alone that no existing slug'\''s scope covers the fact — when coverage is plausible, open and edit that file instead, never a parallel one. Every slug and its one-line index entry MUST be self-describing and state the body'\''s full scope, so the next writer can decide ownership by skimming the index without opening the file. If nothing qualifies, write nothing at all. Operate silently — produce no commentary.' \
  "$discipline" "$slicefile" "$memdir" "$memdir")

# --no-session-persistence: the writer is a background janitor — it must not save a transcript
#   or appear in the resume list (only honoured with --print).
# --allowed-tools is variadic, so the values are space-separated and `--` terminates the flag —
#   otherwise it swallows the prompt as another tool name and the run fails with no prompt.
# Errors go to a per-session log (not /dev/null) so a silent breakage stays diagnosable without
# ever touching the foreground thread.
claude -p --no-session-persistence --settings '{"disableAllHooks":true}' \
  --dangerously-skip-permissions --allowed-tools Read Edit Write -- "$prompt" \
  > "${TMPDIR:-/tmp}/hope-mem-writer-$session.log" 2>&1
exit 0
