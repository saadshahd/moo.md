# Skill Evaluations

Developer documentation for the moo evaluation system.

## Philosophy

**Claude evaluates Claude.** Instead of external test frameworks, we use Claude Code's own capabilities:

1. Claude processes test prompts (letting skills auto-trigger)
2. Claude self-evaluates against expected behaviors
3. Zod schema validates test case structure

## Architecture

```
Test Case (YAML) → bun eval/run.ts → Layer A/C/D → Pass/Fail
```

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Test cases | `hope/eval/cases/*.yaml` | Define prompts and expected behaviors |
| Case schema | `eval/cases/schema.ts` | Zod validation for test case structure |
| Runner | `eval/run.ts` | Discovers and runs all `*/eval/cases/*.yaml` |

## Local Testing

```bash
# Run all hope tests
bun run eval/run.ts hope

# Run single test by name
bun run eval/run.ts --test shape-trigger

# Deep mode (uses default model instead of haiku)
bun run eval/run.ts --deep
```

Pre-push hook runs evals automatically.

## Adding Tests

1. Create `hope/eval/cases/<name>.yaml`
2. Follow the test case format below

### Test Case Format

```yaml
name: kebab-case-name
description: What this validates
plugin: hope
skill: hope:soul
acceptableSkills:
  - soul
  - hope:soul
prompt: "User message that should trigger the skill"
expectedBehaviors:
  - "Specific observable behavior"
  - "Another behavior to check"
flaky: true  # optional — enables retry on failure
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

- Mark with `flaky: true` to enable retries
- Make expectedBehaviors more specific
- Add more context to the test prompt
- Check if skill description needs refinement
