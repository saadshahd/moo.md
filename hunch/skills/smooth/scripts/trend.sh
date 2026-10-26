#!/bin/bash
# trend.sh [project-dir] — how the friction behind the last KEPT smooth fix moved: its count the day
# the fix was made, against the last day's. Kept means merged into HEAD, in the repo or its memory
# folder. Prints one line, `<signal>, <group>: <then> → <now>`, or nothing when no fix was kept.
set -euo pipefail
. "$(dirname "$0")/project.sh"
last=$(for g in "$root" "$mem"; do
         [ "$g" = "$root" ] || [ -d "$g/.git" ] || continue
         git -C "$g" log HEAD --grep '^smooth:' -1 --format="%ct%x09$g%x09%H" 2>/dev/null || true
       done | sort -rn | head -1)
[ -n "$last" ] || exit 0
body=$(git -C "$(printf '%s' "$last" | cut -f2)" show -s --format=%B "$(printf '%s' "$last" | cut -f3)")
sig=$(printf '%s\n' "$body" | sed -n 's/^signal: //p') grp=$(printf '%s\n' "$body" | sed -n 's/^group: //p')
was=$(printf '%s\n' "$body" | sed -n 's/^count: //p')
now=$("$(dirname "$0")/count.sh" --json 1 "$root" |
  jq -r --arg s "$sig" --arg g "$grp" '[.signals[] | select(.name == $s) | .groups[] | select(.g == $g) | .n] | first // 0')
echo "$sig, $grp: $was → $now"
