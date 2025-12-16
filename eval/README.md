# Skill Evaluations

Automated testing for skill triggering and output quality using claude-code-action.

## How It Works

1. **Test cases** define prompts and expected behaviors
2. **Claude evaluates Claude** - processes the prompt and self-evaluates results
3. **JSON schema** enforces structured output via constrained decoding
4. **CI runs on every PR** touching plugin code

## Running Locally

```bash
# Run all tests (simple mode - works with OAuth)
./eval/run.sh --simple

# Run single test
./eval/run.sh --simple hope-gate-completion

# With JSON schema (requires API key, may not work with OAuth)
./eval/run.sh hope-gate-completion

# Help
./eval/run.sh --help
```

**Note:** Use `--simple` for local testing with Claude Max (OAuth). JSON schema mode requires API key.

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

Then add to CI matrix in `.github/workflows/eval.yml`.

## Interpreting Results

| Verdict | Meaning |
|---------|---------|
| PASS | Expected skill triggered, all behaviors observed |
| PARTIAL | Skill triggered but some behaviors missing |
| FAIL | Wrong/no skill triggered |

## Schema

See `eval/schema.json` for the structured output format.
