#!/bin/sh
# Labeled pass-rate harness for the slop-awareness judge (hooks/judge.sh).
# WHY this exists: the judge is a model boundary — a correctness RATE, not a guarantee. Per the
# project's Model-Judgment rule, a rate must be MEASURED on a labeled set before it is trusted.
# This is that measurement.
#
# For each case under cases/<id>/: plant taste-fixture.md as CLAUDE.md in an isolated sandbox
# (so the score depends only on repo contents, never the host's global config — the sandbox sits
# in $TMPDIR, above which no repo CLAUDE.md is discoverable), copy the case's code files in, and
# run the REAL judge (hooks/judge.sh) against them. Score DETERMINISTICALLY — verdict match plus,
# for violations, a planted-keyword check that the judge flagged the RIGHT rule, not a lucky other
# one. No second model scores anything; that would just relocate the unmeasured rate.
#
# Usage: run.sh [case-id-substring]   (no arg = all cases)
set -eu
command -v jq >/dev/null 2>&1 || { echo "jq required" >&2; exit 1; }
command -v claude >/dev/null 2>&1 || { echo "claude required" >&2; exit 1; }

here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
judge="$here/../judge.sh"
fixture="$here/taste-fixture.md"
filter="${1:-}"

tp=0 fn=0 wrong=0 tn=0 fp=0 total=0

for cdir in "$here"/cases/*/; do
  id=$(basename "$cdir")
  [ -n "$filter" ] && { printf '%s' "$id" | grep -q "$filter" || continue; }
  label="$cdir/label.json"
  [ -f "$label" ] || continue
  total=$((total + 1))

  verdict=$(jq -r '.verdict' "$label")
  files=$(jq -r '.files[]' "$label")
  mentions=$(jq -r '.must_mention[]? | ascii_downcase' "$label")

  sandbox=$(mktemp -d "${TMPDIR:-/tmp}/slop-eval-XXXXXX")
  cp "$fixture" "$sandbox/CLAUDE.md"
  list=""
  # Cross-file cases carry sibling paths (drag/x.ts, layout/y.ts); mirror the subtree
  # so the judge's Grep/Glob finds the duplication exactly as it would in the real repo.
  for f in $files; do
    mkdir -p "$sandbox/$(dirname -- "$f")"
    cp "$cdir/$f" "$sandbox/$f"
    list="$list$f
"
  done

  finding=$(cd "$sandbox" && printf '%s' "$list" | "$judge" 2>/dev/null || true)
  rm -rf "$sandbox"

  # Predicted verdict: empty or the CLEAN sentinel on line 1 => CLEAN, else VIOLATION.
  pred=VIOLATION
  { [ -z "$finding" ] || printf '%s' "$finding" | head -n1 | grep -q '^CLEAN$'; } && pred=CLEAN

  outcome=""
  if [ "$verdict" = CLEAN ]; then
    if [ "$pred" = CLEAN ]; then tn=$((tn + 1)); outcome="TN  ok"
    else fp=$((fp + 1)); outcome="FP  false alarm"; fi
  else
    if [ "$pred" = CLEAN ]; then fn=$((fn + 1)); outcome="FN  missed"
    else
      hit=no
      low=$(printf '%s' "$finding" | tr '[:upper:]' '[:lower:]')
      for kw in $mentions; do printf '%s' "$low" | grep -qF "$kw" && { hit=yes; break; }; done
      if [ "$hit" = yes ]; then tp=$((tp + 1)); outcome="TP  ok"
      else wrong=$((wrong + 1)); outcome="WRONG flagged, but not the planted rule"; fi
    fi
  fi

  printf '%-28s %-9s -> %-9s  %s\n' "$id" "$verdict" "$pred" "$outcome"
  [ -n "$finding" ] && printf '%s' "$finding" | sed 's/^/      /'
  echo
done

viol=$((tp + fn + wrong))
clean=$((tn + fp))
echo "------------------------------------------------------------"
printf 'cases:%d  violation:%d  clean:%d\n' "$total" "$viol" "$clean"
printf 'recall      (caught planted violation): %d/%d\n' "$tp" "$viol"
printf 'specificity (stayed silent when clean): %d/%d\n' "$tn" "$clean"
printf 'wrong-flag / false-alarm:               %d / %d\n' "$wrong" "$fp"
printf 'overall pass-rate (TP+TN)/total:        %d/%d\n' "$((tp + tn))" "$total"
