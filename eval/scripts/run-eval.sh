#!/bin/bash
# moo.md Evaluation Framework - Full Evaluation Runner
# Usage: ./eval/scripts/run-eval.sh [category] [--model MODEL]

set -euo pipefail

EVAL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$EVAL_ROOT/.." && pwd)"
RESULTS_DIR="$EVAL_ROOT/results/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

# Parse arguments
CATEGORY="${1:-all}"
MODEL="sonnet"

shift || true
while [[ $# -gt 0 ]]; do
    case $1 in
        --model)
            MODEL="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

echo "=== moo.md Evaluation Framework ==="
echo "Category: $CATEGORY"
echo "Model: $MODEL"
echo "Results: $RESULTS_DIR"
echo ""

# Find test cases
if [ "$CATEGORY" = "all" ]; then
    CASES=$(find "$EVAL_ROOT/cases" -name "*.yaml" -type f | grep -v spike || true)
else
    CASES=$(find "$EVAL_ROOT/cases/$CATEGORY" -name "*.yaml" -type f 2>/dev/null || true)
fi

if [ -z "$CASES" ]; then
    echo "ERROR: No test cases found for category '$CATEGORY'"
    exit 1
fi

CASE_COUNT=$(echo "$CASES" | wc -l | tr -d ' ')
echo "Found $CASE_COUNT test case(s)"
echo ""

# Initialize counters
PASSED=0
FAILED=0
ERRORS=0

# Results array (JSON lines)
RESULTS_FILE="$RESULTS_DIR/results.jsonl"
touch "$RESULTS_FILE"

# Process each test case (use process substitution to avoid subshell)
while read -r CASE_FILE; do
    [ -z "$CASE_FILE" ] && continue

    TEST_NAME=$(basename "$CASE_FILE" .yaml)
    echo "--- Running: $TEST_NAME ---"

    # Extract test config from YAML (simple grep parsing)
    PROMPT=$(grep "^prompt:" "$CASE_FILE" | sed 's/^prompt: *//' | tr -d '"' || echo "")
    EXPECTED_SKILL=$(grep "expected_skill:" "$CASE_FILE" | sed 's/.*expected_skill: *//' | tr -d '"' || echo "")

    # Handle multi-line prompts (look for | indicator)
    if [ -z "$PROMPT" ]; then
        # Multi-line prompt - extract between prompt: | and next key
        PROMPT=$(awk '/^prompt: \|/,/^[a-z_]+:/' "$CASE_FILE" | grep -v "^prompt:" | grep -v "^[a-z_]*:" | tr '\n' ' ' | sed 's/^  *//' || echo "")
    fi

    if [ -z "$PROMPT" ] || [ -z "$EXPECTED_SKILL" ]; then
        echo "  ERROR: Could not parse test case"
        echo "{\"test\":\"$TEST_NAME\",\"status\":\"ERROR\",\"reason\":\"parse_failed\"}" >> "$RESULTS_FILE"
        continue
    fi

    echo "  Expected skill: $EXPECTED_SKILL"

    # Step 1: Run test prompt (2 min timeout)
    echo "  Executing test prompt..."
    START_TIME=$(date +%s)

    TEST_OUTPUT=$(timeout 120s claude -p "$PROMPT" \
        --output-format json \
        --model "$MODEL" \
        2>&1) || {
        echo "  ERROR: Claude CLI failed or timed out"
        echo "{\"test\":\"$TEST_NAME\",\"status\":\"ERROR\",\"reason\":\"cli_failed\"}" >> "$RESULTS_FILE"
        continue
    }

    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))

    # Save raw output
    echo "$TEST_OUTPUT" > "$RESULTS_DIR/$TEST_NAME.output.json"

    # Extract result and permission_denials
    RESULT=$(echo "$TEST_OUTPUT" | jq -r '.result // "NO_RESULT"')
    PERMISSION_DENIALS=$(echo "$TEST_OUTPUT" | jq -c '.permission_denials // []')

    if [ "$RESULT" = "NO_RESULT" ]; then
        echo "  ERROR: No result from Claude"
        echo "{\"test\":\"$TEST_NAME\",\"status\":\"ERROR\",\"reason\":\"no_result\"}" >> "$RESULTS_FILE"
        continue
    fi

    # Step 2: Run trigger evaluator
    echo "  Evaluating trigger..."

    EVAL_PROMPT="You are the trigger-evaluator agent. Evaluate this test output:

TEST NAME: $TEST_NAME
EXPECTED SKILL: $EXPECTED_SKILL

PERMISSION DENIALS (tool calls that were attempted but blocked):
$PERMISSION_DENIALS

TEST OUTPUT (response text):
$RESULT

Analyze whether the expected skill was triggered. Check IN ORDER:
1. PERMISSION DENIALS - If permission_denials contains a Skill tool call with the expected skill, that IS successful triggering (model tried to invoke it)
2. Skill announcement (\"I'm using $EXPECTED_SKILL\")
3. Workflow markers specific to the skill

IMPORTANT RULES:
- A permission denial for the Skill tool with the expected skill = PASS with high confidence (0.95+). The model correctly triggered the skill; the denial is a test infrastructure limitation.
- SPECIAL CASE for hope:soul: This skill is ALWAYS injected via SessionStart hook. It will NOT appear in permission_denials or as a Skill tool call. For hope:soul ONLY, evaluate by checking for workflow markers: \"Silent Audit\", confidence percentages (X% or X-Y%), \"Intent Clarification\". If these markers are present, it's a PASS (0.90+).

Return ONLY valid JSON:
{
  \"triggered\": boolean,
  \"confidence\": number (0-1),
  \"verdict\": \"PASS\" | \"FAIL\" | \"UNCLEAR\",
  \"evidence\": [list of markers found],
  \"rationale\": string
}"

    EVAL_OUTPUT=$(timeout 60s claude -p "$EVAL_PROMPT" \
        --output-format json \
        --model haiku \
        2>&1) || {
        echo "  ERROR: Evaluator failed or timed out"
        echo "{\"test\":\"$TEST_NAME\",\"status\":\"ERROR\",\"reason\":\"evaluator_failed\"}" >> "$RESULTS_FILE"
        continue
    }

    # Save evaluator output
    echo "$EVAL_OUTPUT" > "$RESULTS_DIR/$TEST_NAME.eval.json"

    EVAL_RESULT=$(echo "$EVAL_OUTPUT" | jq -r '.result // "NO_RESULT"')

    # Extract verdict using jq
    VERDICT=$(echo "$EVAL_RESULT" | jq -r '.verdict // "UNKNOWN"' 2>/dev/null || echo "UNKNOWN")
    CONFIDENCE=$(echo "$EVAL_RESULT" | jq -r '.confidence // 0' 2>/dev/null || echo "0")
    TRIGGERED=$(echo "$EVAL_RESULT" | jq -r '.triggered // false' 2>/dev/null || echo "false")

    echo "  Result: $VERDICT (confidence: $CONFIDENCE, triggered: $TRIGGERED)"

    echo "{\"test\":\"$TEST_NAME\",\"expected_skill\":\"$EXPECTED_SKILL\",\"triggered\":$TRIGGERED,\"confidence\":$CONFIDENCE,\"verdict\":\"$VERDICT\",\"duration\":$DURATION}" >> "$RESULTS_FILE"

    echo ""
done <<< "$CASES"

# Generate summary report
echo "=== Generating Report ==="

# Count results
TOTAL=$(wc -l < "$RESULTS_FILE" | tr -d ' ')
PASSED=$(grep -c '"verdict":"PASS"' "$RESULTS_FILE" || echo 0)
FAILED=$(grep -c '"verdict":"FAIL"' "$RESULTS_FILE" || echo 0)
ERRORS=$(grep -c '"status":"ERROR"' "$RESULTS_FILE" || echo 0)
UNCLEAR=$(grep -c '"verdict":"UNCLEAR"' "$RESULTS_FILE" || echo 0)

# Generate markdown report
cat > "$RESULTS_DIR/report.md" << EOF
# Evaluation Report

**Date:** $(date)
**Category:** $CATEGORY
**Model:** $MODEL

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | $TOTAL |
| Passed | $PASSED |
| Failed | $FAILED |
| Unclear | $UNCLEAR |
| Errors | $ERRORS |

## Results

| Test | Expected Skill | Triggered | Confidence | Verdict |
|------|----------------|-----------|------------|---------|
EOF

# Add results to table
while IFS= read -r line; do
    TEST=$(echo "$line" | jq -r '.test // "?"')
    SKILL=$(echo "$line" | jq -r '.expected_skill // "?"')
    TRIG=$(echo "$line" | jq -r '.triggered // "?"')
    CONF=$(echo "$line" | jq -r '.confidence // "?"')
    VERD=$(echo "$line" | jq -r '.verdict // .status // "?"')
    echo "| $TEST | $SKILL | $TRIG | $CONF | $VERD |" >> "$RESULTS_DIR/report.md"
done < "$RESULTS_FILE"

# Add failures section if any
if [ "$FAILED" -gt 0 ] || [ "$ERRORS" -gt 0 ]; then
    echo "" >> "$RESULTS_DIR/report.md"
    echo "## Failures" >> "$RESULTS_DIR/report.md"
    echo "" >> "$RESULTS_DIR/report.md"
    grep -E '"verdict":"FAIL"|"status":"ERROR"' "$RESULTS_FILE" | while IFS= read -r line; do
        TEST=$(echo "$line" | jq -r '.test')
        REASON=$(echo "$line" | jq -r '.rationale // .reason // "No rationale"')
        echo "### $TEST" >> "$RESULTS_DIR/report.md"
        echo "" >> "$RESULTS_DIR/report.md"
        echo "$REASON" >> "$RESULTS_DIR/report.md"
        echo "" >> "$RESULTS_DIR/report.md"
    done
fi

echo ""
echo "=== EVALUATION COMPLETE ==="
echo ""
echo "Results: $RESULTS_DIR"
echo "Report: $RESULTS_DIR/report.md"
echo ""
echo "Summary: $PASSED passed, $FAILED failed, $ERRORS errors out of $TOTAL tests"

# Exit with failure if any tests failed
if [ "$FAILED" -gt 0 ] || [ "$ERRORS" -gt 0 ]; then
    exit 1
fi
