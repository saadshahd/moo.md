#!/bin/bash
# dream.test.sh — dream.sh's plumbing with a stub claude: git, lock, deletion, commit, failure.
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
root=$(mktemp -d "${TMPDIR:-/tmp}/dream.XXXXXX")
trap 'rm -rf "$root"' EXIT
mem=$root/mem repo=$root/repo
mkdir -p "$mem" "$repo" "$root/bin"
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
printf -- '- [a](a.md)\n- [b](b.md)\n' > "$mem/MEMORY.md"
echo 'old fact' > "$mem/a.md"
echo 'cheap fact' > "$mem/b.md"

# On a note pass the stub fixes a.md and deletes b.md by emptying it, as the prompt asks.
# It answers like `claude -p --output-format json`.
cat > "$root/bin/claude" <<'STUB'
#!/bin/bash
prompt=${@: -1}
[ -n "${STUB_FAIL:-}" ] && { echo '{"is_error":true,"result":"boom"}'; exit 0; }
case $prompt in ("# Dream: check a batch"*) sed -i '' 's/old fact/new fact/' "$MEM/a.md"; : > "$MEM/b.md" ;; esac
echo '{"is_error":false,"result":"stub summary"}'
STUB
chmod +x "$root/bin/claude"
export PATH=$root/bin:$PATH MEM=$mem

fails=0
ok() { if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; fails=$((fails + 1)); fi; }

out=$(cd "$repo" && "$here/dream.sh" "$mem" 2>&1); code=$?
ok "first dream exits 0"              '[ $code -eq 0 ]'
ok "memory dir is now a git repo"     '[ -d "$mem/.git" ]'
ok "fix is committed as a dream"      'git -C "$mem" log -1 --format=%s | grep -q "^dream: 2 notes checked" && grep -q "new fact" "$mem/a.md"'
ok "emptied note is deleted"          '[ ! -e "$mem/b.md" ] && ! git -C "$mem" ls-files | grep -q b.md'
ok "lock is not committed"            '! git -C "$mem" ls-files | grep -q consolidate-lock'
ok "output names the undo"            'printf "%s" "$out" | grep -q "undo: git -C"'

out=$(cd "$repo" && "$here/dream.sh" "$mem" 2>&1); code=$?
ok "nothing new: exits 0, says so"    '[ $code -eq 0 ] && printf "%s" "$out" | grep -q "no note is new"'

sleep 30 & held=$!
echo $held > "$mem/.consolidate-lock"
out=$(cd "$repo" && "$here/dream.sh" "$mem" all 2>&1); code=$?
ok "live lock refuses"                '[ $code -eq 1 ] && printf "%s" "$out" | grep -q "another dream"'
echo $held > "$mem/.consolidate-lock"; touch -t 202601010000 "$mem/.consolidate-lock"
out=$(cd "$repo" && "$here/dream.sh" "$mem" all 2>&1); code=$?
ok "hour-old lock is taken as free"   '[ $code -eq 0 ]'
kill $held 2>/dev/null; wait $held 2>/dev/null

before=$(git -C "$mem" rev-parse HEAD)
out=$(cd "$repo" && STUB_FAIL=1 "$here/dream.sh" "$mem" all 2>&1); code=$?
ok "failed pass fails loud"           '[ $code -ne 0 ] && printf "%s" "$out" | grep -q "pass batch-aa failed"'
ok "failure commits nothing"          '[ "$(git -C "$mem" rev-parse HEAD)" = "$before" ]'

[ "$fails" -eq 0 ] && echo "all passed" || { echo "$fails failed"; exit 1; }
