#!/bin/bash
# select.sh <memory-dir> <repo> [all] — the notes a dream checks, one file name per line.
# First dream (no "dream:" commit in the memory dir's git) or "all": every note.
# Otherwise: notes added or changed since the last dream, plus notes that name a repo
# file changed since then. A repo that is not a git repo adds nothing.
set -euo pipefail
[ $# -ge 2 ] || { echo "usage: select.sh <memory-dir> <repo> [all]" >&2; exit 2; }
mem=$1 repo=$2 mode=${3:-}

notes() { (cd "$mem" && ls -1 -- *.md 2>/dev/null | grep -vx 'MEMORY.md' || true); }
last=$(git -C "$mem" log -1 --grep '^dream:' --format=%H 2>/dev/null || true)
if [ "$mode" = all ] || [ -z "$last" ]; then notes; exit 0; fi

{
  git -C "$mem" diff --name-only --diff-filter=AM "$last" -- '*.md'
  git -C "$mem" ls-files --others --exclude-standard -- '*.md'
  since=$(git -C "$mem" log -1 --format=%ct "$last")
  changed=$(git -C "$repo" log --since="@$since" --name-only --format= 2>/dev/null | sort -u | grep . || true)
  if [ -n "$changed" ]; then
    (cd "$mem" && notes | xargs grep -l -F -- "$changed" || true)
  fi
} | { grep -vx 'MEMORY.md' || true; } | sort -u
