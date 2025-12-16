#!/usr/bin/env bash
# Run skill evaluation tests locally
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CASES_DIR="$SCRIPT_DIR/cases/skill-triggers"
SCHEMA_FILE="$SCRIPT_DIR/schema.json"

run_test() {
  local test_file="$1"
  local test_name="$(basename "$test_file" .yaml)"

  echo "=== $test_name ==="

  # Run test with JSON schema
  # --output-format json returns {"type":"result", "structured_output": {...}, ...}
  local schema
  schema=$(cat "$SCHEMA_FILE")

  local result
  if ! result=$(claude -p "Read $test_file. Process the prompt field as if a user sent it, \
let skills auto-trigger. Self-evaluate against expected_behaviors. \
Return JSON with verdict: PASS (all behaviors), PARTIAL (some), FAIL (skill didn't trigger)." \
    --output-format json \
    --json-schema "$schema" 2>/dev/null); then
    echo "ERROR: Claude command failed"
    return 1
  fi

  # Extract verdict from structured_output
  local verdict
  verdict=$(echo "$result" | jq -r '.structured_output.verdict // empty')

  if [ -z "$verdict" ]; then
    echo "ERROR: Could not parse verdict"
    echo "$result" | jq -r '.result // .error // "No result"' | head -5
    return 1
  fi

  echo "Verdict: $verdict"

  if [ "$verdict" = "FAIL" ]; then
    local reasoning
    reasoning=$(echo "$result" | jq -r '.structured_output.reasoning // "No reasoning"')
    echo "Reasoning: $reasoning"
    return 1
  fi

  return 0
}

show_help() {
  echo "Usage: ./eval/run.sh [test-name]"
  echo ""
  echo "Examples:"
  echo "  ./eval/run.sh                      # Run all tests"
  echo "  ./eval/run.sh hope-gate-completion # Run single test"
  echo ""
  echo "Available tests:"
  ls "$CASES_DIR"/*.yaml 2>/dev/null | xargs -n1 basename | sed 's/.yaml$//'
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  show_help
  exit 0
fi

FAILED=0

if [ $# -eq 1 ]; then
  test_file="$CASES_DIR/$1.yaml"
  if [ -f "$test_file" ]; then
    if ! run_test "$test_file"; then
      FAILED=1
    fi
  else
    echo "Test not found: $1"
    show_help
    exit 1
  fi
else
  echo "Running all tests..."
  for f in "$CASES_DIR"/*.yaml; do
    if ! run_test "$f"; then
      FAILED=1
    fi
    echo ""
  done
fi

if [ $FAILED -eq 1 ]; then
  echo "✗ Some tests failed"
  exit 1
fi

echo "✓ All tests passed"
