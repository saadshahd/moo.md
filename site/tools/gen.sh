#!/bin/bash
# Regenerate every demo pane in ../src/demo/sessions from the recorder's
# takes: session files under ~/.claude/projects, captures and key logs in
# ~/moo-rec-tools. Each page plays a pair, <page>-off.ts and <page>-on.ts
# (scenes.ts). Each pane's raw turns go to $OUT for check.sh.
set -euo pipefail
cd "$(dirname "$0")"
OUT=${TMPDIR:-/tmp}/moo-docs-gen
mkdir -p "$OUT"
R=$HOME/moo-rec-tools
S=../src/demo/sessions
# take <page> <off|on>: a take recorded alone, in a copy of its world
# (rec7/<page>-<side>, whose files name the copy, the world and the session).
take() {
  local dir=$R/rec7/$1-$2
  local repo; repo=$(cat "$dir/repo")
  python3 gen.py "$HOME/.claude/projects/$(printf %s "$repo" | tr /. --)/$(cat "$dir/session-id").jsonl" "$repo" "$dir" \
    "$S/$1-$2.ts" --keys "$dir/keylog.json" --raw "$OUT/$1-$2.json" --activity-from-snaps
}
# first <page> <session file> <world> <capture dir>: today's take,
# whose turn 0 ran with all of moo off; the moo-off pane plays that turn alone.
first() {
  python3 gen.py "$2" "$3" "$R/$4" "$S/$1-off.ts" --turns 1 --keys "$R/$4/keylog.json" --raw "$OUT/$1-off.json" --activity-from-snaps
}
P=$HOME/.claude/projects
for page in intent shape compose consult clarify elicit explain interrogate reframe deepen widen anchor freeze reduce draft target router inversion shift judge; do
  take "$page" on
done
take judge off
take clarify off
take anchor off
take chain off
take skills off
# The chain pages' moo-on panes: today's takes, all of moo on.
python3 gen.py "$P/$(printf %s "$HOME" | tr /. --)-invoices/f24358fa-2e6b-42e6-86b1-1591d6551fa8.jsonl" "$HOME/invoices" "$R/rec2/skills" "$S/skills-on.ts" \
  --keys "$R/keylog/skills.json" --raw "$OUT/skills-on.json" --activity-from-snaps
python3 gen.py "$P/$(printf %s "$HOME" | tr /. --)-shop/db17126e-b9e3-4038-a8a5-b3234ff2206e.jsonl" "$HOME/shop" "$R/rec2/chain" "$S/chain-on.ts" \
  --keys "$R/keylog/chain.json" --raw "$OUT/chain-on.json" --activity-from-snaps
first draft "$P/-private-tmp-ship/059abca1-a83f-4860-b7f7-b76340ea8c71.jsonl" /private/tmp/ship rec5/draft
first freeze "$P/-private-tmp-orders/41cb9a31-f9bf-4747-8ffe-ab062e739a8d.jsonl" /private/tmp/orders rec5/freeze
first inversion "$P/-private-tmp-notes-box/e6e801af-24c1-4c55-9df8-1a3dd3f48428.jsonl" /private/tmp/notes-box rec5/inversion
first reduce "$P/-Users-Shared-catalog/48819e2a-8ba3-4fb0-84e7-e92069ab8dad.jsonl" /Users/Shared/catalog rec6/reduce
first intent "$P/-Users-Shared-harness/b85c0514-4eaf-431a-bd2a-c1d9ddb2ea19.jsonl" /Users/Shared/harness rec5/intent
first shape "$P/-Users-Shared-glossary2/f9bd03e0-5a3e-4b36-b9ad-c119dbf14795.jsonl" /Users/Shared/glossary2 rec5/shape2
first explain "$P/-Users-Shared-songbook/7df3e3d8-8160-4d5d-beec-a91a11a4f7ef.jsonl" /Users/Shared/songbook rec5/explain
first elicit "$P/-Users-Shared-taskdesk/b1b2d5e3-76a8-4b4b-8c42-ecde8db5297e.jsonl" /Users/Shared/taskdesk rec5/elicit
first shift "$P/-Users-Shared-agent-kit/9b1e2fb4-7d13-46bb-bfef-b6956ed54df2.jsonl" /Users/Shared/agent-kit rec6/shift2
first interrogate "$P/-Users-Shared-callgate/5c8f031e-615c-433f-9fc7-1f64c02cc60d.jsonl" /Users/Shared/callgate rec5/interrogate
first widen "$P/-Users-Shared-motionpad/035ed991-9174-47d0-b597-e635327f8b9c.jsonl" /Users/Shared/motionpad rec5/widen
first deepen "$P/-Users-Shared-mdcheck/5037ebf8-2b11-44de-af67-08332c4f2df8.jsonl" /Users/Shared/mdcheck rec5/deepen
first reframe "$P/-Users-Shared-shopdeck/bb2058ca-ca5c-4f13-b04b-c6f9e438b387.jsonl" /Users/Shared/shopdeck rec5/reframe
first router "$P/-Users-Shared-taskline/747b138f-f11a-4616-b573-8a4a2f907eef.jsonl" /Users/Shared/taskline rec5/router
first target "$P/-Users-Shared-termsync/42cfda2b-6840-4032-b84c-cb9a2035785a.jsonl" /Users/Shared/termsync rec5/target
first compose "$P/-Users-Shared-agentdesk/da6d1f7c-8940-4ebc-83a2-81e3bb31eb11.jsonl" /Users/Shared/agentdesk rec5/compose
first consult "$P/-Users-Shared-invoicing/5167ffd8-47a9-4085-8a45-be9d6452d419.jsonl" /Users/Shared/invoicing rec5/consult
