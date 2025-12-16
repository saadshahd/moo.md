# Skill Evaluations

Automated testing for skill triggering and output quality.

## Quick Start

```bash
# One-time setup: enable git hooks
git config core.hooksPath .github/hooks

# Run all tests manually
./eval/run.sh
```

## How It Works

| Stage | What Happens |
|-------|--------------|
| **Pre-push hook** | Automatically runs evals for changed plugins only |
| **Manual** | `./eval/run.sh --simple` runs all tests |

1. **Test cases** define prompts and expected behaviors
2. **Claude evaluates Claude** - processes the prompt and self-evaluates results
3. **Git hook** detects which plugins changed and runs only their tests

## Running Manually

```bash
# Run all tests
./eval/run.sh

# Run single test
./eval/run.sh hope-gate-completion

# Help
./eval/run.sh --help
```

## Test Cases

| File | Skill | Purpose |
|------|-------|---------|
| hope-soul-planning.yaml | hope:soul | Planning tasks trigger soul |
| hope-trace-debugging.yaml | hope:trace | Debugging triggers trace |
| hope-gate-completion.yaml | hope:gate | Completion claims trigger gate |
| product-prd-request.yaml | product:product | PRD requests trigger product |
| wordsmith-edit-request.yaml | wordsmith:writing | Edit requests trigger writing |

## Adding New Tests

Create `eval/cases/skill-triggers/<test-name>.yaml`:

```yaml
name: descriptive-test-name
description: What this test validates
plugin: hope
skill: gate
prompt: "User message that should trigger the skill"
expected_behaviors:
  - "Observable behavior 1"
  - "Observable behavior 2"
```

Name the file with the plugin prefix (e.g., `hope-*`, `product-*`) for automatic hook detection.

## Interpreting Results

| Verdict | Meaning |
|---------|---------|
| PASS | Expected skill triggered, all behaviors observed |
| PARTIAL | Skill triggered but some behaviors missing |
| FAIL | Wrong/no skill triggered |

## Skipping Hooks

```bash
git push --no-verify
```

## Schema

See `eval/schema.json` for the structured output format.
