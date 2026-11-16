#!/usr/bin/env bash
# run.sh — sound:find eval runner. Cheap models ONLY (the shared guard).
# Usage: ./run.sh [haiku|sonnet] [trials] [case-id ...]   (default: sonnet 5 all)
set -euo pipefail
cd "$(dirname "$0")"
source ../model-guard.sh
MODEL="${1:-sonnet}"
assert_cheap_model "$MODEL"
shift || true
TRIALS="${1:-5}"; shift || true
exec bun run.mjs "$MODEL" "$TRIALS" "$@"
