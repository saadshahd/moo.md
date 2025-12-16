# Skill Evaluations

Automated testing for skill triggering and output quality.

## Quick Start

**Run locally before merging:**

```bash
./eval/run.sh --simple
```

## How It Works

| Stage | What Happens |
|-------|--------------|
| **Local** | `./eval/run.sh --simple` loads plugins, validates auto-triggering |
| **CI** | Manual trigger via workflow_dispatch, loads plugins via marketplace |

1. **Test cases** define prompts and expected behaviors
2. **Claude evaluates Claude** - processes the prompt and self-evaluates results
3. **JSON schema** enforces structured output via constrained decoding

## Running Locally

```bash
# Run all tests (recommended before merge)
./eval/run.sh --simple

# Run single test
./eval/run.sh --simple hope-gate-completion

# Help
./eval/run.sh --help
```

**Note:** Use `--simple` for Claude Max (OAuth).

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

## CI Notes

- **First-time workflow**: When adding the eval workflow via PR, it won't run on that PR due to GitHub security validation. It starts working on subsequent PRs after merge.
- **Workflow changes**: Same applies when modifying `.github/workflows/eval.yml` - changes only take effect after merge.
