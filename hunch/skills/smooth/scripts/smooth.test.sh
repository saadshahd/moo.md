#!/bin/bash
# smooth.test.sh — count.sh and smooth.sh on planted transcripts, with a stub claude:
# the pick, the branch, .claude/ staging, the memory branch, the trend, and failure.
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$(mktemp -d)" && pwd -P)
trap 'rm -rf "$root"' EXIT
repo=$root/repo
export CLAUDE_CONFIG_DIR=$root/config
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
mkdir -p "$repo/.claude/skills/ship" "$root/bin"
git -C "$repo" init -q
echo '# project' > "$repo/CLAUDE.md"
echo 'ship steps' > "$repo/.claude/skills/ship/SKILL.md"
ln -s ship "$repo/.claude/skills/alias"  # a symlinked skill, as a vendored one is
git -C "$repo" add -A && git -C "$repo" commit -qm init
key=$(printf %s "$repo" | sed 's/[^A-Za-z0-9]/-/g')
proj=$CLAUDE_CONFIG_DIR/projects/$key
mkdir -p "$proj/memory"
echo '- [a](a.md)' > "$proj/memory/MEMORY.md"

# One session's transcript: `make tset` fails, the agent retries, the user sends a prompt.
session() { # <id> <file>
  local t; t=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
  jq -nc --arg s "$1" --arg c "$repo" --arg t "$t" '
    {uuid: "\($s)-1", sessionId: $s, cwd: $c, timestamp: $t, type: "user", message: {content: "run the tests"}},
    {uuid: "\($s)-2", sessionId: $s, cwd: $c, timestamp: $t, type: "assistant",
     message: {content: [{type: "tool_use", id: "\($s)-a", name: "Bash", input: {command: "make tset"}}]}},
    {uuid: "\($s)-3", sessionId: $s, cwd: $c, timestamp: $t, type: "user",
     message: {content: [{type: "tool_result", tool_use_id: "\($s)-a", is_error: true, content: "make: *** No rule to make target tset"}]}}' > "$2"
}
session s1 "$proj/s1.jsonl"

# The stub answers like `claude -p --output-format json`; STUB_MODE picks what it changes.
cat > "$root/bin/claude" <<'STUB'
#!/bin/bash
prompt=${!#}
printf '%s' "$prompt" > "$STUB_SEEN"
[ -n "${STUB_FAIL:-}" ] && { echo '{"is_error":true,"result":"boom"}'; exit 0; }
case ${STUB_MODE:-repo} in
  (repo) echo 'Run tests with `make test`.' >> CLAUDE.md; echo 'ship steps, then make test' > _claude/skills/ship/SKILL.md ;;
  (mem) dir=$(printf '%s\n' "$prompt" | sed -n 's/^Memory folder: //p'); echo 'tests: make test' > "$dir/tests.md" ;;
  (none) ;;
esac
echo "{\"is_error\":false,\"result\":\"the agent runs make test, from $PWD/CLAUDE.md\"}"
STUB
chmod +x "$root/bin/claude"
export PATH=$root/bin:$PATH STUB_SEEN=$root/seen
branch=smooth/$(date +%F)

fails=0
ok() { if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; fails=$((fails + 1)); fi; }
run() { out=$("$here/smooth.sh" "$repo" 2>&1); code=$?; }

counted=$("$here/count.sh" 1 "$repo")
ok "count.sh finds the failed command"   'printf "%s" "$counted" | grep -q "failed commands  1 in 1 session"'

run
ok "one session: no fix, no branch"      '[ $code -eq 0 ] && printf "%s" "$out" | grep -q "no friction recurred" && ! git -C "$repo" rev-parse -q --verify "$branch" >/dev/null'

session s2 "$proj/s2.jsonl"
run
ok "two sessions: exits 0"               '[ $code -eq 0 ]'
ok "prompt names the friction"           'grep -q "Friction: failed commands, make tset — 2 times in 2 sessions" "$root/seen"'
ok "fix sits on the smooth branch"       'git -C "$repo" show "$branch:CLAUDE.md" | grep -q "make test"'
ok ".claude/ staged back from _claude/"  'git -C "$repo" show "$branch:.claude/skills/ship/SKILL.md" | grep -q "make test" && ! git -C "$repo" ls-tree -r --name-only "$branch" | grep -q "^_claude/"'
ok "a symlinked skill stays a symlink"  '[ "$(git -C "$repo" ls-tree "$branch" .claude/skills/alias | cut -c1-6)" = 120000 ]'
ok "commit carries signal and count"     'git -C "$repo" log -1 --format=%B "$branch" | grep -q "^count: 2"'
ok "checked-out branch untouched"        '! grep -q "make test" "$repo/CLAUDE.md" && [ -z "$(git -C "$repo" status --porcelain)" ]'
ok "no worktree left"                    '[ "$(git -C "$repo" worktree list | wc -l)" -eq 1 ]'
ok "output names review, keep, drop"     'printf "%s" "$out" | grep -q "review: git" && printf "%s" "$out" | grep -q "keep:" && printf "%s" "$out" | grep -q "drop:"'

pending=$("$here/pending.sh" "$repo")
ok "pending lists the waiting fix"       '[ "$pending" = "$(printf "%s\t%s\t%s" "$repo" "$branch" "the agent runs make test, from CLAUDE.md")" ]'
ok "a waiting fix has no trend yet"      '[ -z "$("$here/trend.sh" "$repo")" ]'

run
ok "second run today: says so"           '[ $code -eq 0 ] && printf "%s" "$out" | grep -q "already ran today"'

git -C "$repo" branch -q -m "$branch" smooth/2000-01-01
git -C "$repo" merge -q --no-edit smooth/2000-01-01
ok "a kept fix is no longer pending"     '[ -z "$("$here/pending.sh" "$repo")" ]'
STUB_MODE=mem run
ok "trend recounts the last kept fix"         'printf "%s" "$out" | grep -q "trend: failed commands, make tset: 2 → 2"'
ok "memory fix on the memory branch"     'git -C "$proj/memory" show "$branch:tests.md" | grep -q "make test" && [ ! -e "$proj/memory/tests.md" ]'
ok "memory fix leaves no repo branch"    '! git -C "$repo" rev-parse -q --verify "$branch" >/dev/null'

git -C "$proj/memory" branch -q -D "$branch"
STUB_MODE=none run
ok "no change: no branch left"           '[ $code -eq 0 ] && printf "%s" "$out" | grep -q "no fix:" && ! git -C "$repo" rev-parse -q --verify "$branch" >/dev/null && ! git -C "$proj/memory" rev-parse -q --verify "$branch" >/dev/null'

mkdir -p "$repo/.git/hooks"
printf '#!/bin/sh\necho "lint: CLAUDE.md too long" >&2\nexit 1\n' > "$repo/.git/hooks/pre-commit"; chmod +x "$repo/.git/hooks/pre-commit"
git -C "$repo" branch -q -D "$branch" 2>/dev/null
STUB_MODE=repo run
ok "pre-commit refusal: loud, patch kept" '[ $code -ne 0 ] && printf "%s" "$out" | grep -q "pre-commit hook refused" && printf "%s" "$out" | grep -q "lint: CLAUDE.md too long" && printf "%s" "$out" | grep -q "^+Run tests with"'
ok "pre-commit refusal: no branch"       '! git -C "$repo" rev-parse -q --verify "$branch" >/dev/null'
rm "$repo/.git/hooks/pre-commit"

STUB_FAIL=1 run
ok "failed pass fails loud"              '[ $code -ne 0 ] && printf "%s" "$out" | grep -q "the fix pass failed"'
ok "failure leaves no branch"            '! git -C "$repo" rev-parse -q --verify "$branch" >/dev/null'

[ "$fails" -eq 0 ] && echo "all passed" || { echo "$fails failed"; exit 1; }
