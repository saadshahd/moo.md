#!/bin/sh
# Stop: off-record slop-awareness judge. This file selects which repo-bound files the chunk
# touched; judge.sh judges them and owns everything about how — its rubric, its flags, its bar.
#
# Registered asyncRewake — Claude Code never waits, so the foreground turn ends with no
# interruption. The judge runs detached. Never gates, persists nothing.
#
# Fails open at every step — a missing tool, file, or transcript must never stall a session.
command -v jq >/dev/null 2>&1 || exit 0
command -v claude >/dev/null 2>&1 || exit 0

input=$(cat)
tp=$(printf '%s' "$input" | jq -r '.transcript_path // empty')
[ -f "$tp" ] || exit 0

# Per-transcript offset marker, keyed by the transcript basename. Stores the line count already
# judged; the chunk is everything after it. Advancing it every stop makes the judge idempotent
# across successive Stops — no prior stop is ever re-judged.
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

# Keep only paths that still exist live (a written-then-deleted file leaves no ghost to judge) and
# that belong to version control. Taste and maintainability are properties of code that lives, or
# is declared to live, in the repo; a charter, a handover note between agents, or a generated
# one-off HTML file is none of those, and judging it is pure noise. `git status` answers all three
# questions in one call per file: `!!` ignored, `??` untracked-and-unstaged, a non-zero exit means
# no worktree contains it — each is out. Everything else (clean, modified, staged) is in, so
# `git add` is what declares a brand-new file as repo-bound and admits it to the judge.
# Absent git, the filter is skipped entirely rather than dropping every file — a filter that cannot
# run must not silently disable the judge.
gitfilter=0
command -v git >/dev/null 2>&1 && gitfilter=1
live=$(printf '%s\n' "$files" | while IFS= read -r f; do
  [ -n "$f" ] && [ -f "$f" ] || continue
  if [ "$gitfilter" = 1 ]; then
    st=$(git -C "$(dirname "$f")" status --porcelain --ignored=matching -- "$f" 2>/dev/null) || continue
    # Prefix tests, not `case`: bash 3.2 — /bin/sh on macOS, which the shebang selects — misparses a
    # case pattern's `)` inside $( ) as the end of the substitution.
    [ "${st#\?\?}" != "$st" ] && continue
    [ "${st#!!}" != "$st" ] && continue
  fi
  printf '%s\n' "$f"
done)

# Nothing survived selection → nothing to judge. The natural gate: pure Q&A / planning turns,
# pure-deletion turns, and turns that only wrote scratch never spawn the judge.
[ -z "$live" ] && exit 0

# The verdict logic lives in judge.sh — the single source shared with the eval harness. We feed
# it the live file list and capture its finding; its stderr goes to a per-transcript log, never
# /dev/null, so a silent breakage stays diagnosable off-thread.
finding=$(printf '%s\n' "$live" | "$(dirname "$0")/judge.sh" \
  2>"${TMPDIR:-/tmp}/hope-slop-judge-$tpkey.log")

# Clean (empty or the CLEAN sentinel) → silent exit 0, no wake, no forced turn.
[ -z "$finding" ] && exit 0
printf '%s' "$finding" | head -n1 | grep -q '^CLEAN$' && exit 0

# Finding → wake Claude with an advisory nudge on stderr (exit 2). Advisory only: it names the
# violation and explicitly does not block.
{
  echo "Slop-awareness nudge. A file you touched this turn may violate a preference:"
  printf '%s\n' "$finding"
} >&2
exit 2
