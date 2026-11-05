#!/bin/bash
# Check every demo pane against the recorder's captures: each pane's
# transcript against its take's tall captures at 45, 80 and 120 columns (run
# gen.sh first: it writes the raw turns this reads), then every dialog
# capture, then both prompts of each page by rule 2, then every pane for
# machine paths and the sandbox, then each pane of the built site's demos
# for idle stands.
cd "$(dirname "$0")"
OUT=${TMPDIR:-/tmp}/moo-docs-gen
R=$HOME/moo-rec-tools
fail=0
# <pane>:<capture dir>. A moo-off pane cut to today's first turn is held to
# its capture above the next prompt (check-screen.mts).
PANES=(
  skills-off:rec7/skills-off skills-on:rec2/skills chain-off:rec7/chain-off chain-on:rec2/chain
  judge-off:rec7/judge-off clarify-off:rec5/clarify draft-off:rec5/draft freeze-off:rec5/freeze
  inversion-off:rec5/inversion reduce-off:rec6/reduce intent-off:rec5/intent shape-off:rec5/shape2
  explain-off:rec5/explain elicit-off:rec5/elicit shift-off:rec6/shift2 interrogate-off:rec5/interrogate
  anchor-off:rec6/anchor widen-off:rec5/widen deepen-off:rec5/deepen reframe-off:rec5/reframe
  router-off:rec5/router target-off:rec5/target compose-off:rec5/compose consult-off:rec5/consult
)
for page in intent shape compose consult clarify elicit explain interrogate reframe deepen widen anchor freeze reduce draft target router inversion shift judge; do
  PANES+=("$page-on:rec7/$page-on")
done
for t in "${PANES[@]}"; do
  pane=${t%%:*} dir=$R/${t#*:}
  for w in 45 80 120; do
    # The recorder's tall3 captures replace tall where both exist.
    cap=$dir/tall3-$w.ansi; [ -f "$cap" ] || cap=$dir/tall-$w.ansi
    out=$(npx tsx check-screen.mts "$OUT/$pane.json" "$cap" "$w") || fail=1
    echo "$pane $w: $out"
  done
done
npx tsx check-dialogs.mts || fail=1
npx tsx check-prompts.mts || fail=1
npx tsx check-leaks.mts || fail=1
(cd .. && npm run build >/dev/null) || fail=1
npx tsx check-timing.mts ../dist || fail=1
exit $fail
