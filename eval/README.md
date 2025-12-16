# Skill Trigger Test Cases

Test cases for validating skill auto-triggering. Preserved for future promptfoo migration.

## Status

**ARCHIVED** - These test cases are preserved for reference. The shell script infrastructure was removed as overly complex.

## Future: Promptfoo Migration

Convert to promptfoo format:

```yaml
# promptfooconfig.yaml
providers:
  - id: anthropic:claude-sonnet-4-20250514

tests:
  - vars:
      prompt: "Help me plan a new user dashboard feature"
    assert:
      - type: contains
        value: "Silent Audit"
      - type: icontains
        value: "%"  # confidence percentage
```

## Test Cases

| File | Skill | Purpose |
|------|-------|---------|
| hope-soul-planning.yaml | hope:soul | Planning task triggers soul |
| hope-trace-debugging.yaml | hope:trace | Debugging triggers trace |
| hope-gate-completion.yaml | hope:gate | Completion claims trigger gate |
| product-prd-request.yaml | product:product | PRD requests trigger product |
| wordsmith-edit-request.yaml | wordsmith:writing | Edit requests trigger writing |
