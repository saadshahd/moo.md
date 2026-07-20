#!/usr/bin/env bash
# Labeled pass-rate harness for the sound:review skill (../review/SKILL.md).
# WHY this exists: sound:review is a model-judgment boundary — a correctness RATE, not a
# guarantee (CLAUDE.md "Model-Judgment Boundaries"; the corpus rule correctness-is-a-measured-rate).
# It must be MEASURED on a labeled set before it is trusted. This is that measurement.
#
# Each case under cases/<id>/ is a real MINED diff (ported from hope/hooks/slop-nudge.evals/,
# themselves mined from real Claude Code sessions — never fabricated; fabricated fixtures have
# zero discriminating power, the #154/#162 lesson). Per (case, run):
#   1. build a throwaway git repo in $TMPDIR,
#   2. commit base_files (pre-existing code the review may explore — e.g. the already-owned
#      equivalent in a cross-file duplication case), giving `git diff --cached` a real HEAD,
#   3. stage diff_files — THE CHANGE UNDER REVIEW,
#   4. install the full sound corpus into .claude/sound/ (install-sound-tree.sh),
#   5. run the REAL skill: claude -p reads ../review/SKILL.md and executes it against the diff,
#   6. score DETERMINISTICALLY — verdict match, plus a planted-keyword check that a VIOLATION
#      was flagged on the RIGHT rule, not a lucky other one. No second model scores anything.
#
# Repeated N times per case (N>=3): one run is never a fact. Runs fan out with a bounded
# concurrency pool; each (case,run) writes its own row file (no append race) and its own
# .out/.err. A run whose reply is a session-limit / API error is scored ERR and EXCLUDED — the
# summary prints the excluded count (no silent caps), never mis-scoring a non-answer as a verdict.
#
# Usage: run.sh [--model haiku|sonnet] [--runs N] [--jobs K] [case-id-substring]
set -eu

MODEL=sonnet; RUNS=3; JOBS=4; FILTER=
while [ $# -gt 0 ]; do
  case "$1" in
    --model) MODEL="$2"; shift 2 ;;
    --runs)  RUNS="$2";  shift 2 ;;
    --jobs)  JOBS="$2";  shift 2 ;;
    *)       FILTER="$1"; shift ;;
  esac
done

command -v jq >/dev/null 2>&1 || { echo "jq required" >&2; exit 1; }
command -v claude >/dev/null 2>&1 || { echo "claude required" >&2; exit 1; }
command -v git >/dev/null 2>&1 || { echo "git required" >&2; exit 1; }
command -v bun >/dev/null 2>&1 || { echo "bun required (scores the rows)" >&2; exit 1; }
case "$MODEL" in haiku|sonnet) ;; *) echo "cheap models only (haiku|sonnet), got '$MODEL'" >&2; exit 1 ;; esac

here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
skill="$here/../review/SKILL.md"
soundroot=$(CDPATH= cd -- "$here/../.." && pwd)
[ -f "$skill" ] || { echo "skill not found: $skill" >&2; exit 1; }

runlog="$here/runs/$(date +%Y%m%d-%H%M%S)-$MODEL-N$RUNS"
mkdir -p "$runlog"

# Read and execute the ACTUAL shipped skill — never a copied-out prompt (a copy is a fork that
# drifts from what ships; judge.sh's one-source principle).
prompt="Read the skill file at $skill and follow it EXACTLY as written. The change under review is the staged diff — run \`git diff --cached\` yourself to see it. The project's taste rules are installed under .claude/sound/. Output ONLY what the skill's Report step specifies (the finding lines, or the single token CLEAN) — no preamble."

one_run() {  # $1=case-dir $2=id $3=run
  # Produces ONLY the raw review reply ($out) + stderr ($err). ALL deterministic scoring —
  # verdict prediction, non-answer detection, keyword matching, outcome — lives in score.mjs,
  # the single scoring authority. Shell is a poor place to match multi-word anchors or group
  # boolean guards (both were live bugs here); JS does it once, correctly. one_run ALWAYS leaves
  # an $out file (empty on install failure) so the post-wait vanish-guard can count it.
  cdir="$1"; id="$2"; run="$3"
  label="$cdir/label.json"
  base_files=$(jq -r '.base_files[]?' "$label")
  diff_files=$(jq -r '.diff_files[]' "$label")
  out="$runlog/$id.run$run.out"; err="$runlog/$id.run$run.err"

  sandbox=$(mktemp -d "${TMPDIR:-/tmp}/review-eval-XXXXXX")
  ( cd "$sandbox"
    git init -q; git config user.email eval@moo.local; git config user.name eval
    git commit -q --allow-empty -m base )
  for f in $base_files; do mkdir -p "$sandbox/$(dirname -- "$f")"; cp "$cdir/$f" "$sandbox/$f"; done
  [ -n "$base_files" ] && ( cd "$sandbox" && git add -A && git commit -q -m pre-existing )
  for f in $diff_files; do mkdir -p "$sandbox/$(dirname -- "$f")"; cp "$cdir/$f" "$sandbox/$f"; done
  ( cd "$sandbox" && git add -A )

  # Install failure leaves an empty $out + a loud $err note — score.mjs reads that as a non-answer
  # (ERR, excluded), never a vanished run. Guarded with `if !` so set -e can't kill the subshell.
  if ! "$here/install-sound-tree.sh" "$sandbox" >/dev/null 2>"$err"; then
    : > "$out"
    printf '%-30s run%s  install failed (-> ERR)\n' "$id" "$run"
    rm -rf "$sandbox"; return
  fi

  ( cd "$sandbox" && claude -p --model "$MODEL" \
      --no-session-persistence --settings '{"disableAllHooks":true}' \
      --permission-mode bypassPermissions --add-dir "$soundroot" \
      -- "$prompt" ) > "$out" 2>"$err" || true
  rm -rf "$sandbox"
  printf '%-30s run%s  done\n' "$id" "$run"
}

launched=0
for cdir in "$here"/cases/*/; do
  id=$(basename "$cdir")
  [ -n "$FILTER" ] && { printf '%s' "$id" | grep -q "$FILTER" || continue; }
  [ -f "$cdir/label.json" ] || continue
  run=1
  while [ "$run" -le "$RUNS" ]; do
    while [ "$(jobs -rp | wc -l)" -ge "$JOBS" ]; do sleep 2; done
    one_run "$cdir" "$id" "$run" &
    launched=$((launched + 1))
    run=$((run + 1))
  done
done
wait

# Fail loud if any (case,run) vanished: every launched run MUST have left an $out file (real reply
# or empty-on-install-failure). A short count means a subshell died silently — never score on it.
written=$(ls "$runlog"/*.run*.out 2>/dev/null | wc -l | tr -d ' ')
if [ "$written" -ne "$launched" ]; then
  echo "!!! FAIL LOUD: launched $launched runs but only $written .out files — $((launched - written)) vanished." >&2
  echo "!!! Inspect $runlog for missing <case>.run<N>.out before trusting any summary." >&2
  exit 1
fi

echo "------------------------------------------------------------"
echo "raw replies: $runlog/*.run*.out ($written files, all $launched launched runs accounted for)"
# score.mjs is the single scoring authority — reads the raw .out replies + labels and computes
# everything. Capture its exit status directly (a `| tee` pipe would mask a crashing scorer as 0).
bun "$here/score.mjs" "$runlog" > "$runlog/SUMMARY.txt" || { echo "scorer failed — see above" >&2; exit 1; }
cat "$runlog/SUMMARY.txt"
