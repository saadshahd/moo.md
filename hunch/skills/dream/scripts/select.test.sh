#!/bin/bash
# select.test.sh — which notes a dream checks: all on the first dream, then only new,
# changed, or naming a repo file changed since the last dream.
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
root=$(mktemp -d "${TMPDIR:-/tmp}/select.XXXXXX")
trap 'rm -rf "$root"' EXIT
mem=$root/mem repo=$root/repo
mkdir -p "$mem" "$repo/src"
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t

printf -- '- [a](a.md)\n- [b](b.md)\n- [c](c.md)\n' > "$mem/MEMORY.md"
echo 'names src/app.ts' > "$mem/a.md"
echo 'names nothing' > "$mem/b.md"
echo 'names src/other.ts' > "$mem/c.md"
git -C "$repo" init -q
echo x > "$repo/src/app.ts"; echo x > "$repo/src/other.ts"
git -C "$repo" add -A && GIT_COMMITTER_DATE=2026-01-01T00:00:00 git -C "$repo" commit -qm init
git -C "$mem" init -q && git -C "$mem" add -A && git -C "$mem" commit -qm before

fails=0
check() { # <name> <want> <args...>
  local name=$1 want=$2; shift 2
  got=$("$here/select.sh" "$mem" "$repo" "$@") || got="exit $?"; got=$(printf "%s" "$got" | tr "\n" " ")
  if [ "$got" = "$want" ]; then echo "ok   $name"; else echo "FAIL $name: got '$got', want '$want'"; fails=$((fails + 1)); fi
}

check "first dream checks every note" "a.md b.md c.md"
git -C "$mem" commit -qm "dream: 3 notes checked" --allow-empty
sleep 1
check "nothing changed since the last dream" ""
check "all checks every note" "a.md b.md c.md" all
echo y >> "$repo/src/app.ts"; git -C "$repo" commit -qam "touch app"
check "note naming a changed repo file" "a.md"
echo 'new' > "$mem/d.md"
check "new note, uncommitted" "a.md d.md"
echo more >> "$mem/b.md"
check "edited note" "a.md b.md d.md"

[ "$fails" -eq 0 ] && echo "all passed" || { echo "$fails failed"; exit 1; }
