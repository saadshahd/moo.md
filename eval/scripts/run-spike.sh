#!/bin/bash
# moo.md Evaluation Framework - Architecture Spike
# Purpose: Validate multi-agent evaluation pattern works
#
# Success criteria:
#   1. Agent spawning works
#   2. YAML parsing works
#   3. JSON output captured
#   4. Cost < $0.05

set -euo pipefail

EVAL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RESULTS_DIR="$EVAL_ROOT/results/spike-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

echo "=== moo.md Evaluation Spike ==="
echo "Results: $RESULTS_DIR"
echo ""

# Step 1: Parse test case YAML
echo "Step 1: Reading test case..."
TEST_CASE="$EVAL_ROOT/cases/spike/hope-soul-trigger.yaml"

if [ ! -f "$TEST_CASE" ]; then
    echo "ERROR: Test case not found: $TEST_CASE"
    exit 1
fi

# Extract prompt (simple grep - YAML parsing in shell is limited)
PROMPT=$(grep "^prompt:" "$TEST_CASE" | sed 's/^prompt: *//' | tr -d '"')
EXPECTED_SKILL=$(grep "expected_skill:" "$TEST_CASE" | sed 's/.*expected_skill: *//' | tr -d '"')

echo "  Test: hope-soul-triggers-on-planning"
echo "  Prompt: $PROMPT"
echo "  Expected skill: $EXPECTED_SKILL"
echo ""

# Step 2: Execute test prompt with headless Claude
echo "Step 2: Running test prompt with claude -p..."
START_TIME=$(date +%s)

TEST_OUTPUT=$(claude -p "$PROMPT" \
    --output-format json \
    --model haiku \
    2>&1) || {
    echo "ERROR: Claude CLI failed"
    echo "$TEST_OUTPUT"
    exit 1
}

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Save raw output
echo "$TEST_OUTPUT" > "$RESULTS_DIR/test-output.json"

# Extract metrics from JSON
COST=$(echo "$TEST_OUTPUT" | jq -r '.total_cost_usd // 0')
RESULT=$(echo "$TEST_OUTPUT" | jq -r '.result // "NO_RESULT"')

echo "  Duration: ${DURATION}ms"
echo "  Cost: \$$COST"
echo "  Output saved: $RESULTS_DIR/test-output.json"
echo ""

# Step 3: Spawn trigger-evaluator agent
echo "Step 3: Spawning trigger-evaluator agent..."

EVAL_PROMPT="You are the trigger-evaluator agent. Evaluate this test output:

TEST OUTPUT:
$RESULT

EXPECTED SKILL: $EXPECTED_SKILL

Analyze whether the expected skill was triggered. Return ONLY valid JSON matching this schema:
{
  \"triggered\": boolean,
  \"expected_skill\": string,
  \"evidence\": {
    \"announcement_found\": boolean,
    \"workflow_markers\": [string]
  },
  \"confidence\": number (0-1),
  \"verdict\": \"PASS\" | \"FAIL\" | \"UNCLEAR\",
  \"rationale\": string
}"

EVAL_OUTPUT=$(claude -p "$EVAL_PROMPT" \
    --output-format json \
    --model haiku \
    2>&1) || {
    echo "ERROR: Evaluator agent failed"
    echo "$EVAL_OUTPUT"
    exit 1
}

# Save evaluator output
echo "$EVAL_OUTPUT" > "$RESULTS_DIR/evaluator-output.json"

EVAL_RESULT=$(echo "$EVAL_OUTPUT" | jq -r '.result // "NO_RESULT"')
EVAL_COST=$(echo "$EVAL_OUTPUT" | jq -r '.total_cost_usd // 0')

echo "  Evaluator cost: \$$EVAL_COST"
echo "  Evaluator output saved: $RESULTS_DIR/evaluator-output.json"
echo ""

# Step 4: Parse and display results
echo "Step 4: Parsing results..."

# Try to extract verdict from evaluator result (it may be wrapped in markdown)
VERDICT=$(echo "$EVAL_RESULT" | grep -o '"verdict"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*: *"//' | tr -d '"' || echo "UNKNOWN")
CONFIDENCE=$(echo "$EVAL_RESULT" | grep -o '"confidence"[[:space:]]*:[[:space:]]*[0-9.]*' | head -1 | sed 's/.*: *//' || echo "0")
TRIGGERED=$(echo "$EVAL_RESULT" | grep -o '"triggered"[[:space:]]*:[[:space:]]*[a-z]*' | head -1 | sed 's/.*: *//' || echo "unknown")

echo ""
echo "=== SPIKE RESULTS ==="
echo ""
echo "| Metric | Value |"
echo "|--------|-------|"
echo "| Test Duration | ${DURATION}s |"
echo "| Test Cost | \$$COST |"
echo "| Evaluator Cost | \$$EVAL_COST |"
TOTAL_COST=$(echo "$COST + $EVAL_COST" | bc 2>/dev/null || echo "N/A")
echo "| Total Cost | \$$TOTAL_COST |"
echo "| Triggered | $TRIGGERED |"
echo "| Confidence | $CONFIDENCE |"
echo "| Verdict | $VERDICT |"
echo ""

# Step 5: Validate success criteria
echo "=== SUCCESS CRITERIA ==="
echo ""

PASS_COUNT=0
TOTAL_CRITERIA=3

# Criterion 1: Agent spawning
if [ -f "$RESULTS_DIR/evaluator-output.json" ]; then
    echo "[PASS] Agent spawning works"
    ((PASS_COUNT++))
else
    echo "[FAIL] Agent spawning failed"
fi

# Criterion 2: YAML parsing (we got the prompt and skill)
if [ -n "$PROMPT" ] && [ -n "$EXPECTED_SKILL" ]; then
    echo "[PASS] YAML parsing works"
    ((PASS_COUNT++))
else
    echo "[FAIL] YAML parsing failed"
fi

# Criterion 3: JSON output captured
if [ "$EVAL_RESULT" != "NO_RESULT" ]; then
    echo "[PASS] JSON output captured"
    ((PASS_COUNT++))
else
    echo "[FAIL] JSON output not captured"
fi

# Cost tracking (informational only - Max plan has unlimited)
echo "[INFO] Cost: \$$TOTAL_COST (informational)"

echo ""
echo "=== SUMMARY ==="
echo "Passed: $PASS_COUNT / $TOTAL_CRITERIA criteria"
echo ""

if [ "$PASS_COUNT" -eq "$TOTAL_CRITERIA" ]; then
    echo "✅ SPIKE SUCCESSFUL - Architecture validated!"
    echo ""
    echo "Ready to proceed with Phase 1 implementation."
    exit 0
else
    echo "❌ SPIKE FAILED - Review results above"
    echo ""
    echo "Check $RESULTS_DIR for detailed output."
    exit 1
fi
