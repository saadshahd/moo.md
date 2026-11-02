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
take invoices f24358fa-2e6b-42e6-86b1-1591d6551fa8 rec2/skills skills 0=tfsdk9.846 1=12y0zha.384
take shop db17126e-b9e3-4038-a8a5-b3234ff2206e rec2/chain chain 0=23q9us.1586
# One session per take, in a world take() can't name: turn 0 ran with all of
# moo off, the later turns with it on.
python3 gen.py "$HOME/.claude/projects/-Users-Shared-relay/88e77a6e-df44-4292-a0b9-80bb76951473.jsonl" /Users/Shared/relay "$R/rec5/clarify" ../src/demo/sessions/clarify.ts 1=1nh2zwu.460 \
  --keys "$R/rec5/clarify/keylog.json" --raw "$OUT/clarify.json" --activity-from-snaps
python3 gen.py "$HOME/.claude/projects/-private-tmp-ship/059abca1-a83f-4860-b7f7-b76340ea8c71.jsonl" /private/tmp/ship "$R/rec5/draft" ../src/demo/sessions/draft.ts 1=16v4raq.684 \
  --keys "$R/rec5/draft/keylog.json" --raw "$OUT/draft.json" --activity-from-snaps
python3 gen.py "$HOME/.claude/projects/-private-tmp-orders/41cb9a31-f9bf-4747-8ffe-ab062e739a8d.jsonl" /private/tmp/orders "$R/rec5/freeze" ../src/demo/sessions/freeze.ts 1=9za8h9.2481 2=82nmta.250 \
  --keys "$R/rec5/freeze/keylog.json" --raw "$OUT/freeze.json" --activity-from-snaps
python3 gen.py "$HOME/.claude/projects/-private-tmp-notes-box/e6e801af-24c1-4c55-9df8-1a3dd3f48428.jsonl" /private/tmp/notes-box "$R/rec5/inversion" ../src/demo/sessions/inversion.ts 1=lbn3eh.795 \
  --keys "$R/rec5/inversion/keylog.json" --raw "$OUT/inversion.json" --activity-from-snaps
python3 gen.py "$HOME/.claude/projects/-Users-Shared-catalog/48819e2a-8ba3-4fb0-84e7-e92069ab8dad.jsonl" /Users/Shared/catalog "$R/rec6/reduce" ../src/demo/sessions/reduce.ts  \
  --keys "$R/rec6/reduce/keylog.json" --raw "$OUT/reduce.json" --activity-from-snaps
python3 gen.py "$HOME/.claude/projects/-Users-Shared-harness/b85c0514-4eaf-431a-bd2a-c1d9ddb2ea19.jsonl" /Users/Shared/harness "$R/rec5/intent" ../src/demo/sessions/intent.ts 1=ha69of.1849 \
  --keys "$R/rec5/intent/keylog.json" --raw "$OUT/intent.json" --activity-from-snaps
python3 gen.py "$HOME/.claude/projects/-Users-Shared-glossary2/f9bd03e0-5a3e-4b36-b9ad-c119dbf14795.jsonl" /Users/Shared/glossary2 "$R/rec5/shape2" ../src/demo/sessions/shape.ts 1=1idh1op.901 \
  --keys "$R/rec5/shape2/keylog.json" --raw "$OUT/shape.json" --activity-from-snaps
python3 gen.py "$HOME/.claude/projects/-Users-Shared-songbook/7df3e3d8-8160-4d5d-beec-a91a11a4f7ef.jsonl" /Users/Shared/songbook "$R/rec5/explain" ../src/demo/sessions/explain.ts  \
  --keys "$R/rec5/explain/keylog.json" --raw "$OUT/explain.json" --activity-from-snaps
python3 gen.py "$HOME/.claude/projects/-Users-Shared-taskdesk/b1b2d5e3-76a8-4b4b-8c42-ecde8db5297e.jsonl" /Users/Shared/taskdesk "$R/rec5/elicit" ../src/demo/sessions/elicit.ts 2=p2fc51.516 3=p7jusv.1214 \
  --keys "$R/rec5/elicit/keylog.json" --raw "$OUT/elicit.json" --activity-from-snaps
python3 gen.py "$HOME/.claude/projects/-Users-Shared-agent-kit/9b1e2fb4-7d13-46bb-bfef-b6956ed54df2.jsonl" /Users/Shared/agent-kit "$R/rec6/shift2" ../src/demo/sessions/shift.ts 1=1x004a.933 \
  --keys "$R/rec6/shift2/keylog.json" --raw "$OUT/shift.json" --activity-from-snaps
python3 gen.py "$HOME/.claude/projects/-Users-Shared-callgate/5c8f031e-615c-433f-9fc7-1f64c02cc60d.jsonl" /Users/Shared/callgate "$R/rec5/interrogate" ../src/demo/sessions/interrogate.ts 1=wyaxdk.1470 \
  --keys "$R/rec5/interrogate/keylog.json" --raw "$OUT/interrogate.json" --activity-from-snaps
python3 gen.py "$HOME/.claude/projects/-Users-Shared-billing/07241682-be5d-45db-92c4-87443ee0449e.jsonl" /Users/Shared/billing "$R/rec6/anchor" ../src/demo/sessions/anchor.ts 1=191385i.1253 \
  --keys "$R/rec6/anchor/keylog.json" --raw "$OUT/anchor.json" --activity-from-snaps
python3 gen.py "$HOME/.claude/projects/-Users-Shared-motionpad/035ed991-9174-47d0-b597-e635327f8b9c.jsonl" /Users/Shared/motionpad "$R/rec5/widen" ../src/demo/sessions/widen.ts 1=cxplqx.2109 \
  --keys "$R/rec5/widen/keylog.json" --raw "$OUT/widen.json" --activity-from-snaps
python3 gen.py "$HOME/.claude/projects/-Users-Shared-mdcheck/5037ebf8-2b11-44de-af67-08332c4f2df8.jsonl" /Users/Shared/mdcheck "$R/rec5/deepen" ../src/demo/sessions/deepen.ts 3=1yb24mf.883 \
  --keys "$R/rec5/deepen/keylog.json" --raw "$OUT/deepen.json" --activity-from-snaps
python3 gen.py "$HOME/.claude/projects/-Users-Shared-chimebox/78d4c320-8c1f-471a-86b6-3913ad568ab6.jsonl" /Users/Shared/chimebox "$R/rec5/judge" ../src/demo/sessions/judge.ts 1=unihze.385 \
  --keys "$R/rec5/judge/keylog.json" --raw "$OUT/judge.json" --activity-from-snaps
