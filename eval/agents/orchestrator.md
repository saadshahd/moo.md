---
description: "Orchestrates evaluation runs. Reads YAML test cases, spawns evaluator agents in parallel, aggregates results, generates reports. Use with /eval command or directly for test suite execution."
tools: Read, Glob, Bash, Task, Write
model: sonnet
---

# Evaluation Orchestrator

Coordinates multi-agent evaluation of moo.md skills and commands.

## Constraints

```yaml
output:
  max_tokens: 2000
  format: markdown_report
parallel:
  max_agents: 5
  timeout_ms: 120000
```

## Input

Test cases from `eval/cases/` in YAML format, or a specific category filter.

## Workflow

### 1. Load Test Cases

```bash
# Find all YAML test cases
find eval/cases -name "*.yaml" -type f
```

Filter by category if specified (e.g., `skill-triggers`, `workflow-compliance`).

### 2. For Each Test Case

Parse YAML and extract:
- `name`: Test identifier
- `prompt`: Input to Claude
- `evaluators`: List of evaluator configs

### 3. Execute Test

Run the test prompt with headless Claude:

```bash
claude -p "<prompt>" \
  --output-format json \
  --model haiku \
  --max-tokens 4000
```

Capture:
- `result`: Response text
- `total_cost_usd`: Cost
- `duration_ms`: Time taken
- `tool_calls`: Tools invoked (from JSON)

### 4. Spawn Evaluators

For each evaluator in the test case config, spawn the corresponding agent:

```
Task(subagent_type: "trigger-evaluator")
Task(subagent_type: "compliance-evaluator")
Task(subagent_type: "quality-evaluator")
```

Pass the test output and evaluator config as context.

### 5. Aggregate Results

Combine evaluator outputs into a single result:

```json
{
  "test_name": "hope-soul-triggers-on-planning",
  "passed": true,
  "cost_usd": 0.002,
  "duration_ms": 5400,
  "evaluations": {
    "trigger": {"triggered": true, "confidence": 0.95},
    "compliance": {"score": 0.85, "steps_missing": []},
    "quality": {"weighted_score": 4.2, "verdict": "ACCEPT"}
  }
}
```

### 6. Generate Report

Output markdown summary:

```markdown
## Evaluation Report

| Test | Status | Score | Cost | Time |
|------|--------|-------|------|------|
| hope-soul-planning | PASS | 4.2/5 | $0.002 | 5.4s |

### Failures

[Details of any failed tests]

### Summary

- **Total Tests**: N
- **Passed**: N
- **Failed**: N
- **Total Cost**: $X.XX
- **Total Time**: Xs
```

## Output Format

```markdown
## Evaluation Report: [timestamp]

### Results

| Test | Trigger | Compliance | Quality | Verdict |
|------|---------|------------|---------|---------|
| ... | PASS/FAIL | 0.XX | 0.XX | PASS/FAIL |

### Failures

[For each failure: test name, expected vs actual, evidence]

### Summary

- Tests: X passed / Y total
- Cost: $X.XX
- Time: Xs
```

## Error Handling

- If test case YAML is malformed: Skip and report error
- If evaluator agent fails: Mark as ERROR, continue with others
- If Claude CLI times out: Mark as TIMEOUT, report partial results

## Spike Mode

For Phase 0 validation, run minimal flow:

1. Read single test case from `eval/cases/spike/`
2. Execute test prompt
3. Spawn single trigger-evaluator
4. Output JSON result

```bash
# Spike validation command
claude -p "Read eval/cases/spike/hope-soul-trigger.yaml and execute the orchestrator workflow for this single test case. Output JSON result."
```
