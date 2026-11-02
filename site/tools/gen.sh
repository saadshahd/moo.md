#!/bin/bash
# Regenerate every demo session in ../src/demo/sessions from the recorder's
# takes: session files under ~/.claude/projects, captures and key logs in
# ~/moo-rec-tools. Each turn's raw form goes to $OUT for check.sh.
set -euo pipefail
cd "$(dirname "$0")"
OUT=${TMPDIR:-/tmp}/moo-docs-gen
mkdir -p "$OUT"
P=$HOME/.claude/projects/$(printf %s "$HOME" | tr /. --)
R=$HOME/moo-rec-tools
# take <world> <session id> <capture dir> <page> [N=tend short key ...]
take() {
  python3 gen.py "$P-$1/$2.jsonl" "$HOME/$1" "$R/$3" "../src/demo/sessions/$4.ts" "${@:5}" \
    --keys "$R/keylog/$4.json" --raw "$OUT/$4.json" --activity-from-snaps
}
take billing da305481-3f66-456c-a1dc-04d9f93b97c9 rec3/anchor anchor 0=zzmx9.799
take invoices f24358fa-2e6b-42e6-86b1-1591d6551fa8 rec2/skills skills 0=tfsdk9.846 1=12y0zha.384
take shop db17126e-b9e3-4038-a8a5-b3234ff2206e rec2/chain chain 0=23q9us.1586
# A world under /private/tmp, which take() can't name. Turn 0 ran with all of
# moo off, turn 1 with it on, in one session.
python3 gen.py "$HOME/.claude/projects/-private-tmp-catalog/7b225a66-32b2-4468-8bb5-711b0f6cb6a1.jsonl" /private/tmp/catalog "$R/rec5/reduce" ../src/demo/sessions/reduce.ts  \
  --keys "$R/rec5/reduce/keylog.json" --raw "$OUT/reduce.json" --activity-from-snaps
python3 gen.py "$HOME/.claude/projects/-Users-Shared-relay/88e77a6e-df44-4292-a0b9-80bb76951473.jsonl" /Users/Shared/relay "$R/rec5/clarify" ../src/demo/sessions/clarify.ts 1=1nh2zwu.460 \
  --keys "$R/rec5/clarify/keylog.json" --raw "$OUT/clarify.json" --activity-from-snaps
python3 gen.py "$HOME/.claude/projects/-private-tmp-ship/059abca1-a83f-4860-b7f7-b76340ea8c71.jsonl" /private/tmp/ship "$R/rec5/draft" ../src/demo/sessions/draft.ts 1=16v4raq.684 \
  --keys "$R/rec5/draft/keylog.json" --raw "$OUT/draft.json" --activity-from-snaps
python3 gen.py "$HOME/.claude/projects/-private-tmp-orders/41cb9a31-f9bf-4747-8ffe-ab062e739a8d.jsonl" /private/tmp/orders "$R/rec5/freeze" ../src/demo/sessions/freeze.ts 1=9za8h9.2481 2=82nmta.250 \
  --keys "$R/rec5/freeze/keylog.json" --raw "$OUT/freeze.json" --activity-from-snaps
