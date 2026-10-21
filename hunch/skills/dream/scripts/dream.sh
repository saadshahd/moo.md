#!/bin/bash
# dream.sh <memory-dir> [all] — check a project's memory notes against the repo in the
# current directory, fix the ones that went false, tidy MEMORY.md, and commit it all as one
# "dream:" commit in the memory dir's own git. Prints the commit and how to undo it.
#
# Notes go to Sonnet in batches so every selected note gets checked: one call told to check
# a whole folder spot-checks a few and stops (measured on moo's 86 notes, 2026-10-21).
set -euo pipefail
command -v claude >/dev/null 2>&1 || { echo "dream: claude not on PATH" >&2; exit 127; }
[ $# -ge 1 ] || { echo "usage: dream.sh <memory-dir> [all]" >&2; exit 2; }
mem=$(cd "$1" && pwd) mode=${2:-}
repo=$PWD
here=$(cd "$(dirname "$0")/.." && pwd)
[ -f "$mem/MEMORY.md" ] || { echo "dream: no MEMORY.md in $mem" >&2; exit 1; }

# Claude Code's own dream uses this lock: body = holder's PID, mtime = last consolidation.
lock=$mem/.consolidate-lock
# A PID older than an hour is taken as reused, not held.
if [ -n "$(find "$lock" -mmin -60 2>/dev/null)" ] && kill -0 "$(cat "$lock")" 2>/dev/null; then
  echo "dream: another dream holds $lock (pid $(cat "$lock"))" >&2; exit 1
fi
echo $$ > "$lock"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
trap 'echo "dream: failed; uncommitted edits so far: git -C \"$mem\" diff" >&2' ERR

if [ ! -d "$mem/.git" ]; then
  git -C "$mem" init -q
  echo .consolidate-lock > "$mem/.gitignore"
fi
git -C "$mem" add -A
git -C "$mem" diff --cached --quiet || git -C "$mem" commit -qm "notes before dream"

"$here/scripts/select.sh" "$mem" "$repo" "$mode" > "$work/selected"
if [ ! -s "$work/selected" ]; then
  echo "dream: no note is new or names a changed file since the last dream. Run with all to check every note."
  exit 0
fi

# The passes get no shell: an allowed `git log` can still write files (--output).
# History comes precomputed instead.
git -C "$repo" log --date=short --format='%h %ad %s' --name-status -n 500 > "$work/history.txt" 2>/dev/null \
  || echo "(the project is not a git repo)" > "$work/history.txt"
context="Memory directory: $mem/"$'\n'"Repo history, newest first: $work/history.txt"

call() { # <name> <prompt> — one headless pass; its final text goes to <name>.out
  # disableAllHooks: no hook fires inside the pass. outputStyle default keeps the person's
  # style out of the summaries. dontAsk + the allowlist: reads anywhere, writes only to
  # notes in the memory dir (an Edit rule covers Write too; .git is protected).
  claude -p --model sonnet --no-session-persistence --output-format json \
    --permission-mode dontAsk \
    --settings "{\"disableAllHooks\":true,\"outputStyle\":\"default\",\"autoMemoryDirectory\":\"$mem\"}" \
    --allowed-tools Read Grep Glob "Edit(/$mem/*.md)" -- \
    "$2"$'\n\n'"$(cat "$here/house.md")"$'\n\n'"$context" > "$work/$1.json"
  python3 -c 'import json,sys; r=json.load(open(sys.argv[1])); print(r["result"]); sys.exit(1 if r.get("is_error") else 0)' \
    "$work/$1.json" > "$work/$1.out" || { echo "dream: pass $1 failed: $(head -c 400 "$work/$1.json")" >&2; false; }
}

split -l 15 "$work/selected" "$work/batch-"
for list in "$work"/batch-??; do
  call "$(basename "$list")" "$(cat "$here/batch.md")"$'\n\n'"Notes:"$'\n'"$(sed 's/^/- /' "$list")"
done
# A pass deletes a note by emptying it; it has no shell to remove files.
find "$mem" -maxdepth 1 -name '*.md' ! -name MEMORY.md -empty -delete
call index "$(cat "$here/index.md")"$'\n\n'"What the note passes did:"$'\n'"$(cat "$work"/batch-??.out)"

git -C "$mem" add -A
git -C "$mem" commit -qm "dream: $(wc -l < "$work/selected" | tr -d ' ') notes checked" --allow-empty
cat "$work/index.out"
echo
git -C "$mem" show --stat --format='commit %h' HEAD | sed '/^$/d'
echo "undo: git -C \"$mem\" revert --no-edit HEAD"
