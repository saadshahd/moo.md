#!/usr/bin/env bash
# run.sh — sound:setup eval runner. Deterministic scoring, cheap models ONLY.
# Usage: ./run.sh [haiku|sonnet] [fixture-name ...]   (default: sonnet, all fixtures)
set -euo pipefail
cd "$(dirname "$0")"

MODEL="${1:-sonnet}"
case "$MODEL" in
  haiku|sonnet|claude-haiku-*|claude-sonnet-*) ;;
  *) echo "REFUSED: evals run on haiku/sonnet only, never opus/fable (got: $MODEL)" >&2; exit 2 ;;
esac
shift || true

SKILL="$(cd ../skills/setup && pwd)/SKILL.md"
FIXTURES=("$@")
[ ${#FIXTURES[@]} -eq 0 ] && FIXTURES=($(ls fixtures))

RUN_DIR="runs/$(date +%Y%m%d-%H%M%S)-$MODEL"
mkdir -p "$RUN_DIR"
total=0; passed=0

for fx in "${FIXTURES[@]}"; do
  repo="$(pwd)/fixtures/$fx/repo"
  [ -d "$repo" ] || { echo "SKIP $fx (no repo/)"; continue; }
  out="$RUN_DIR/$fx.json"
  echo "== $fx ($MODEL)"
  printf '%s' "Read the skill file at $SKILL. Execute it in PROPOSE-ONLY mode against the repository at $repo (this is a trimmed skeleton: tree.txt lists the real repo's full file listing — treat it as ground truth for which files exist; the included source files are real excerpts). Run Phase 1 (probe) and Phase 4 (tune paths) only. Output ONLY the propose-only JSON object, nothing else." \
    | claude -p --model "$MODEL" \
    --allowedTools "Read,Glob,Grep,Bash(find:*),Bash(ls:*),Bash(cat:*)" \
    --add-dir "$repo" \
    > "$out" 2>"$RUN_DIR/$fx.err" || { echo "FAIL $fx (runner error, see $RUN_DIR/$fx.err)"; total=$((total+1)); continue; }
  total=$((total+1))
  if bun score.mjs "fixtures/$fx" "$out" > "$RUN_DIR/$fx.score"; then
    passed=$((passed+1)); echo "PASS $fx"
  else
    echo "FAIL $fx"; cat "$RUN_DIR/$fx.score"
  fi
done

echo "=================================================="
echo "TOTAL: $passed/$total fixtures fully passing ($RUN_DIR)"
[ "$passed" -eq "$total" ]
