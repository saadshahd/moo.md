#!/bin/bash
# scrub.test.sh — a planted leak exits 1 and names it; a clean draft exits 0.
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
root=$(mktemp -d)
trap 'rm -rf "$root"' EXIT

export CLAUDE_CONFIG_DIR="$root/config"
mkdir -p "$CLAUDE_CONFIG_DIR/projects/-acme" "$root/acme-billing"
git -C "$root/acme-billing" init -q
git -C "$root/acme-billing" remote add origin git@github.com:acme-corp/acme-billing.git

cat > "$CLAUDE_CONFIG_DIR/projects/-acme/s1.jsonl" <<JSONL
{"type":"user","uuid":"u1","cwd":"$root/acme-billing","message":{"content":"fix the invoice rounding"}}
{"type":"assistant","uuid":"a1","cwd":"$root/acme-billing","message":{"content":[{"type":"tool_use","id":"t1","name":"Edit","input":{"file_path":"$root/acme-billing/src/ledger/rounding.ts"}},{"type":"tool_use","id":"t2","name":"Bash","input":{"command":"cat /opt/acme/secrets/keys.env"}}]}}
JSONL

fails=0
check() { # <name> <want-exit> <want-in-output> <draft text>
  printf '%s\n' "$4" > "$root/draft.md"
  out=$("$here/scrub.sh" s1 "$root/draft.md" 2>&1); got=$?
  if [ "$got" -ne "$2" ] || { [ -n "$3" ] && ! printf '%s' "$out" | grep -qF -- "$3"; }; then
    echo "FAIL $1: exit $got (want $2), output:"; printf '%s\n' "$out" | sed 's/^/  /'; fails=$((fails + 1))
  else
    echo "ok   $1"
  fi
}

check "clean draft passes"      0 ""                  "Turn 4: the user re-explained the goal. <repo> stayed private."
check "repo name"               1 "repo: acme-billing" "Seen in acme-billing at turn 4."
check "remote slug"             1 "remote: acme-corp/acme-billing" "Pushed to acme-corp/acme-billing."
check "file path, repo-relative" 1 "path: src/ledger/rounding.ts" "It edited src/ledger/rounding.ts twice."
check "path inside a Bash call" 1 "path: /opt/acme/secrets/keys.env" "It read /opt/acme/secrets/keys.env."
check "machine user"            1 "user: $USER"        "Run by $USER."
check "home folder"             1 "home: $HOME"        "Logs in $HOME/logs."
check "case-blind"              1 "repo: ACME-BILLING" "ACME-BILLING again."
check "public repo is allowed"  0 ""                  "File this on saadshahd/moo.md."
"$here/scrub.sh" nope "$root/draft.md" >/dev/null 2>&1; [ $? -eq 2 ] && echo "ok   unknown session exits 2" || { echo "FAIL unknown session"; fails=$((fails + 1)); }

[ "$fails" -eq 0 ] && echo "all passed" || { echo "$fails failed"; exit 1; }
