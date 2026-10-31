#!/usr/bin/env bash
# run.sh — lookup-first eval runner. Cheap models ONLY (the shared guard).
# Usage: ./run.sh [haiku|sonnet] [trials] [dev|heldout|all] [case-id ...]   (default: sonnet 3 all)
set -euo pipefail
cd "$(dirname "$0")"
source ../model-guard.sh
MODEL="${1:-sonnet}"
assert_cheap_model "$MODEL"
shift || true
TRIALS="${1:-3}"; shift || true
exec bun run.mjs "$MODEL" "$TRIALS" "$@"
