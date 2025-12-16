#!/usr/bin/env bash
# Run skill evaluation tests locally
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CASES_DIR="$SCRIPT_DIR/cases/skill-triggers"
SCHEMA_FILE="$SCRIPT_DIR/schema.json"

# Check for --simple flag (skip JSON schema)
SIMPLE_MODE=false
if [[ "${1:-}" == "--simple" ]]; then
  SIMPLE_MODE=true
  shift
fi

run_test() {
  local test_file="$1"
  local test_name="$(basename "$test_file" .yaml)"

  echo "=== $test_name ==="

  if [ "$SIMPLE_MODE" = true ]; then
    # Simple mode: text output, no JSON schema
    claude -p "Read $test_file. Process the prompt field as if a user sent it, \
let skills auto-trigger. Self-evaluate against expected_behaviors. \
Report: Skill Triggered: [yes/no], Verdict: [PASS/PARTIAL/FAIL], Reasoning: [brief]"
  else
    # Full mode: JSON schema (requires API key, may not work with OAuth)
    SCHEMA="$(cat "$SCHEMA_FILE")"
    claude -p "Read $test_file. Process the prompt field as if a user sent it, \
let skills auto-trigger. Self-evaluate against expected_behaviors. \
Return JSON with verdict: PASS (all behaviors), PARTIAL (some), FAIL (skill didn't trigger)." \
      --output-format json \
      --json-schema "$SCHEMA"
  fi
  echo ""
}

show_help() {
  echo "Usage: ./eval/run.sh [--simple] [test-name]"
  echo ""
  echo "Options:"
  echo "  --simple    Use text output (works with OAuth, no JSON schema)"
  echo ""
  echo "Examples:"
  echo "  ./eval/run.sh                      # Run all tests with JSON schema"
  echo "  ./eval/run.sh --simple             # Run all tests with text output"
  echo "  ./eval/run.sh hope-gate-completion # Run single test"
  echo "  ./eval/run.sh --simple hope-gate   # Run single test, text output"
  echo ""
  echo "Available tests:"
  ls "$CASES_DIR"/*.yaml 2>/dev/null | xargs -n1 basename | sed 's/.yaml$//'
}

# Handle help
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  show_help
  exit 0
fi

# Run specific test or all tests
if [ $# -eq 1 ]; then
  test_file="$CASES_DIR/$1.yaml"
  if [ -f "$test_file" ]; then
    run_test "$test_file"
  else
    echo "Test not found: $1"
    echo ""
    echo "Available tests:"
    ls "$CASES_DIR"/*.yaml | xargs -n1 basename | sed 's/.yaml$//'
    exit 1
  fi
else
  echo "Running all tests..."
  echo ""
  for f in "$CASES_DIR"/*.yaml; do
    run_test "$f"
  done
fi
