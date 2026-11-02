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
take catalog b7212ad9-5d95-4cc6-8995-103a9399db1c rec2/reduce reduce 0=1bazap6.1471
take invoices f24358fa-2e6b-42e6-86b1-1591d6551fa8 rec2/skills skills 0=tfsdk9.846 1=12y0zha.384
take shop db17126e-b9e3-4038-a8a5-b3234ff2206e rec2/chain chain 0=23q9us.1586
