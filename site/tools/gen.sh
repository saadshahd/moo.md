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
take orders 4a9b9619-c027-490e-88d4-e8b049c797e1 rec3/freeze freeze 0=1438gmx.2638 1=mda649.169
take billing da305481-3f66-456c-a1dc-04d9f93b97c9 rec3/anchor anchor 0=zzmx9.799
take ship d087d508-ca94-4b7f-9589-c2527bb9d1dd rec3/draft draft 0=p72nx4.1034
take invoices f24358fa-2e6b-42e6-86b1-1591d6551fa8 rec2/skills skills 0=tfsdk9.846 1=12y0zha.384
take shop db17126e-b9e3-4038-a8a5-b3234ff2206e rec2/chain chain 0=23q9us.1586
# A world under /private/tmp, which take() can't name. Turn 0 ran with all of
# moo off, turn 1 with it on, in one session.
python3 gen.py "$HOME/.claude/projects/-private-tmp-catalog/7b225a66-32b2-4468-8bb5-711b0f6cb6a1.jsonl" /private/tmp/catalog "$R/rec5/reduce" ../src/demo/sessions/reduce.ts  \
  --keys "$R/rec5/reduce/keylog.json" --raw "$OUT/reduce.json" --activity-from-snaps
python3 gen.py "$HOME/.claude/projects/-Users-Shared-relay/88e77a6e-df44-4292-a0b9-80bb76951473.jsonl" /Users/Shared/relay "$R/rec5/clarify" ../src/demo/sessions/clarify.ts 1=1nh2zwu.460 \
  --keys "$R/rec5/clarify/keylog.json" --raw "$OUT/clarify.json" --activity-from-snaps
