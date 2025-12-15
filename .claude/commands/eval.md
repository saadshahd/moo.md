---
description: Run evaluation suite against moo.md plugins. Tests skill triggering, workflow compliance, and output quality.
---

# /eval

Run the moo.md evaluation suite.

## Usage

```
/eval [category] [options]
```

## Categories

- `all` (default) - Run all test cases
- `skill-triggers` - Test skill auto-triggering
- `workflow-compliance` - Test workflow step compliance
- `output-quality` - Test output quality scoring
- `end-to-end` - Test complete user journeys

## Options

- `--model MODEL` - Model to test (haiku, sonnet, opus). Default: sonnet
- `--verbose` - Show detailed output

## Examples

```bash
/eval                          # Run all tests with sonnet
/eval skill-triggers           # Run trigger tests only
/eval --model haiku            # Run all with haiku
/eval skill-triggers --verbose # Detailed trigger test output
```

## Workflow

1. **Load test cases** from `eval/cases/$ARGUMENTS/`
2. **Execute each test** with headless Claude (`claude -p`)
3. **Spawn evaluator agents** (trigger, compliance, quality)
4. **Aggregate results** into JSON
5. **Generate report** in markdown

## Execute

Read test cases from `eval/cases/` and run the evaluation:

```
Category: $ARGUMENTS (default: all)
```

### Step 1: Find Test Cases

Use Glob to find all YAML test cases in the specified category:
- If category is "all" or empty: `eval/cases/**/*.yaml`
- Otherwise: `eval/cases/$ARGUMENTS/*.yaml`

### Step 2: For Each Test Case

1. Read the YAML file
2. Extract: `name`, `prompt`, `evaluators`, `model_tier`
3. Run: `claude -p "<prompt>" --output-format json --model <model_tier>`
4. Capture the JSON output

### Step 3: Evaluate Results

For each test, spawn the trigger-evaluator agent:

```
Evaluate this test output for skill triggering:

TEST NAME: <name>
EXPECTED SKILL: <expected_skill from evaluators config>

TEST OUTPUT:
<result from claude -p>

Return JSON: {triggered, confidence, verdict, rationale}
```

### Step 4: Generate Report

Output a markdown table with results:

```markdown
## Evaluation Report

| Test | Expected Skill | Triggered | Confidence | Verdict |
|------|----------------|-----------|------------|---------|
| ... | ... | ... | ... | ... |

### Summary
- Total: N tests
- Passed: N
- Failed: N

### Failures
[Details of any failures]
```

### Step 5: Save Results

Write results to `eval/results/<timestamp>/`:
- `summary.json` - Aggregate statistics
- `report.md` - Human-readable report
- `<test-name>.json` - Individual test results
