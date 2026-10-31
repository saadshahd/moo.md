#!/bin/bash
# smooth.sh [day|week|month] [project-dir] — count the project's executor friction over that window
# (default day), have Sonnet make ONE fix
# for the friction that recurred across the most sessions, and leave it on a `smooth/<date>` branch:
# in the repo, or in the memory folder's git when the fix is a memory note. Nothing lands on the
# checked-out branch; the person keeps or drops it. Prints the trend of the last fix, the new fix,
# and the commands to review, keep and drop it.
set -euo pipefail
command -v claude >/dev/null 2>&1 || { echo "smooth: claude not on PATH" >&2; exit 127; }
here=$(cd "$(dirname "$0")/.." && pwd)
window="${1:-day}"
. "$here/scripts/project.sh" "${2:-.}"
branch="smooth/$(date +%F)"

if git -C "$root" rev-parse -q --verify "refs/heads/$branch" >/dev/null ||
   { [ -d "$mem/.git" ] && git -C "$mem" rev-parse -q --verify "refs/heads/$branch" >/dev/null; }; then
  echo "smooth: already ran today ($branch)"; exit 0
fi

work=$(cd "$(mktemp -d "${TMPDIR:-/tmp}/smooth.XXXXXX")" && pwd -P)
# A branch still at its start holds no fix: a failed or empty run leaves none behind.
cleanup() {
  local g
  for g in "$root" "$mem"; do
    [ -d "$g/.git" ] || [ "$g" = "$root" ] || continue
    git -C "$g" worktree remove --force "$work/$( [ "$g" = "$root" ] && echo repo || echo mem)" 2>/dev/null || true
    if git -C "$g" rev-parse -q --verify "refs/heads/$branch" >/dev/null &&
       [ -z "$(git -C "$g" log --format=%H "HEAD..$branch" 2>/dev/null)" ]; then
      git -C "$g" branch -q -D "$branch"
    fi
  done
  rm -rf "$work"
}
trap cleanup EXIT

"$here/scripts/count.sh" --json "$window" "$root" > "$work/counted.json"

t=$("$here/scripts/trend.sh" "$root")
[ -z "$t" ] || echo "trend: $t"

# The friction to fix: the group spread over the most sessions, at least two. Interrupts have no home in the project.
jq '[.signals[] | select(.name != "interrupts") | . as $s | .groups[] | select(.sessions >= 2) | . + {signal: $s.name, home: $s.fix}]
    | sort_by(-.sessions, -.n) | first // empty' "$work/counted.json" > "$work/pick.json"
if [ ! -s "$work/pick.json" ]; then
  echo "smooth: no friction recurred across sessions in the last $window; no fix"; exit 0
fi
sig=$(jq -r .signal "$work/pick.json") grp=$(jq -r .g "$work/pick.json")
n=$(jq -r .n "$work/pick.json") sessions=$(jq -r .sessions "$work/pick.json")

git -C "$root" worktree add -q -b "$branch" "$work/repo" HEAD
# Headless writes to .claude/ are refused in every mode short of bypass, so its tracked files go to _claude/ and back.
# A symlink is skipped: a write through it would land outside the worktree.
[ ! -e "$work/repo/_claude" ] || { echo "smooth: the repo has its own _claude/; cannot stage .claude/ there" >&2; exit 1; }
( cd "$work/repo" && git ls-files -z .claude | while IFS= read -r -d "" f; do [ -L "$f" ] && continue; mkdir -p "_claude/$(dirname "${f#.claude/}")"; cp "$f" "_claude/${f#.claude/}"; done )

memline="This project has no memory folder: no memory note can be the fix."
if [ -f "$mem/MEMORY.md" ]; then
  if [ ! -d "$mem/.git" ]; then git -C "$mem" init -q; echo .consolidate-lock > "$mem/.gitignore"; fi
  git -C "$mem" add -A
  git -C "$mem" diff --cached --quiet || git -C "$mem" commit -qm "notes before smooth"
  git -C "$mem" worktree add -q -b "$branch" "$work/mem" HEAD
  memline="Memory folder: $work/mem/"
fi

prompt="$(sed "s|<config>|$config|" "$here/fix.md")

Friction: $sig, $grp — $n times in $sessions sessions. Its usual home: $(jq -r .home "$work/pick.json").
Calls behind it:
$(jq -r '.calls[] | "- session \(.s) at \(.t): \(.what)\n  result: \(.result // "none" | gsub("\n"; " "))"' "$work/pick.json")

Project repo (your current directory): $work/repo/
$memline"

allowed=(Read Grep Glob "Edit(/$work/repo/**)" "Write(/$work/repo/**)")
[ -d "$work/mem" ] && allowed+=("Edit(/$work/mem/**)" "Write(/$work/mem/**)")
# disableAllHooks: no hook fires inside the pass. dontAsk + the allowlist: reads anywhere, writes only in the two worktrees.
( cd "$work/repo" && claude -p --model sonnet --no-session-persistence --output-format json \
    --permission-mode dontAsk --settings '{"disableAllHooks":true,"outputStyle":"default"}' \
    --allowed-tools "${allowed[@]}" -- "$prompt" < /dev/null ) > "$work/fix.json"
line=$(python3 -c 'import json,sys; r=json.load(open(sys.argv[1])); print(r["result"].strip().splitlines()[-1] if r["result"].strip() else ""); sys.exit(1 if r.get("is_error") else 0)' "$work/fix.json") \
  || { echo "smooth: the fix pass failed: $(head -c 400 "$work/fix.json")" >&2; exit 1; }
# The worktrees are gone after this run: name files from their own folder.
line=$(printf '%s' "$line" | sed "s|$work/repo/||g; s|$work/mem/|memory/|g")

if [ -d "$work/repo/_claude" ]; then
  ( cd "$work/repo" && mkdir -p .claude && cp -R _claude/. .claude/ && rm -rf _claude )
fi

msg="smooth: $line

signal: $sig
group: $grp
count: $n
window: $window"
made=""
for w in repo mem; do
  [ -d "$work/$w" ] || continue
  git -C "$work/$w" add -A
  git -C "$work/$w" diff --cached --quiet && continue
  # The project's own pre-commit hook judges the fix like any other commit; a refusal keeps the fix in this output.
  if ! err=$(git -C "$work/$w" commit -qm "$msg" 2>&1); then
    echo "smooth: the fix was written, and the project's pre-commit hook refused it:" >&2
    printf '%s\n' "$err" | tail -20 >&2
    echo "the fix, as a patch:" >&2; git -C "$work/$w" diff --cached --no-ext-diff >&2
    exit 1
  fi
  made="$made $w"
done

echo "friction: $sig, $grp — $n times in $sessions sessions"
if [ -z "$made" ]; then echo "no fix: $line"; exit 0; fi
echo "fix: $line"
for w in $made; do
  g=$( [ "$w" = repo ] && echo "$root" || echo "$mem")
  git -C "$g" show --stat --format='' "$branch" | sed '/^$/d; s/^/  /'
  echo "review: git -C \"$g\" diff HEAD...$branch"
  echo "keep:   git -C \"$g\" merge --no-edit $branch"
  echo "drop:   git -C \"$g\" branch -D $branch"
done
