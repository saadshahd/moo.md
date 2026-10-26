#!/bin/bash
# pending.sh [project-dir] — the smooth fixes still waiting to be kept or dropped: one line per
# smooth/ branch not merged into HEAD, in the repo or its memory folder: <dir> TAB <branch> TAB <the fix>.
set -euo pipefail
. "$(dirname "$0")/project.sh"
for g in "$root" "$mem"; do
  [ "$g" = "$root" ] || [ -d "$g/.git" ] || continue
  git -C "$g" branch --list 'smooth/*' --no-merged HEAD --format='%(refname:short)%09%(contents:subject)' |
    awk -v g="$g" -F'\t' '{ sub(/^smooth: /, "", $2); print g "\t" $1 "\t" $2 }'
done
