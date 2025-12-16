# Skill Evaluations

Developer documentation for the moo.md evaluation system.

## Philosophy

**Claude evaluates Claude.** Instead of external test frameworks, we use Claude Code's own capabilities:

1. Claude processes test prompts (letting skills auto-trigger)
2. Claude self-evaluates against expected behaviors
3. JSON schema enforces structured output via constrained decoding

This matches Claude Code's "evaluation-through-usage" philosophy.

## Architecture

```
Test Case (YAML) → claude-code-action → JSON Schema → Pass/Fail
```

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Test cases | `eval/cases/skill-triggers/*.yaml` | Define prompts and expected behaviors |
| JSON schema | `eval/schema.json` | Enforce structured eval output |
| CI workflow | `.github/workflows/eval.yml` | Run evals on PRs |

## CI Workflow

Runs automatically on PRs touching:
- `hope/**`, `product/**`, `wordsmith/**`, `founder/**`, `career/**`
- `eval/**`

Also available via manual `workflow_dispatch`.

### Matrix Strategy

Each test runs in parallel:
- `hope-gate-completion`
- `hope-soul-planning`
- `hope-trace-debugging`
- `product-prd-request`
- `wordsmith-edit-request`

## Local Testing

```bash
# Run all tests
./eval/run.sh

# Run single test
./eval/run.sh hope-gate-completion
```

See `eval/README.md` for more details.

## Adding Tests

1. Create `eval/cases/skill-triggers/<name>.yaml`
2. Add to matrix in `.github/workflows/eval.yml`

### Test Case Format

```yaml
name: kebab-case-name
description: What this validates
plugin: hope
skill: gate
prompt: "User message that should trigger the skill"
expected_behaviors:
  - "Specific observable behavior"
  - "Another behavior to check"
```

### Expected Behaviors Guidelines

- Be specific and observable
- Reference actual skill output markers (e.g., "Silent Audit", "Evidence Hierarchy")
- Avoid subjective criteria

## Troubleshooting

### Skill not triggering

- Check skill description in SKILL.md frontmatter
- Ensure prompt contains trigger keywords from description
- Verify skill is properly registered in plugin.json

### Flaky tests

- Make expected_behaviors more specific
- Add more context to the test prompt
- Check if skill description needs refinement

## Why Not promptfoo?

- Third-party tool (not Anthropic-endorsed)
- Adds dependency and config files
- Slower, more brittle in practice
- claude-code-action already handles what we need

## Why Not Claude Agent SDK?

- Requires `ANTHROPIC_API_KEY` (separate billing)
- Claude Max only provides OAuth token for claude-code-action
- Would add unnecessary cost
