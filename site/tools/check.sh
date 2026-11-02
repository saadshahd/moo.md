#!/bin/bash
# Check every demo against the recorder's captures: each take's transcript
# against its tall captures at 45, 80 and 120 columns (run gen.sh first: it
# writes the raw turns this reads), then every dialog capture, then every
# skill take for machine paths and the sandbox.
cd "$(dirname "$0")"
OUT=${TMPDIR:-/tmp}/moo-docs-gen
R=$HOME/moo-rec-tools
fail=0
for t in freeze:rec3/freeze anchor:rec3/anchor draft:rec3/draft skills:rec2/skills chain:rec2/chain reduce:rec5/reduce clarify:rec5/clarify; do
  page=${t%%:*} dir=$R/${t#*:}
  for w in 45 80 120; do
    # The recorder's tall3 captures replace tall where both exist.
    cap=$dir/tall3-$w.ansi; [ -f "$cap" ] || cap=$dir/tall-$w.ansi
    out=$(npx tsx check-screen.mts "$OUT/$page.json" "$cap" "$w") || fail=1
    echo "$page $w: $out"
  done
done
npx tsx check-dialogs.mts || fail=1
npx tsx check-leaks.mts || fail=1
exit $fail
