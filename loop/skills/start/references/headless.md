# Headless Mode

Running loop in CI/CD environments without interactive prompts.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOOP_HEADLESS` | `false` | Enable headless mode (no interactive prompts) |
| `LOOP_BUDGET` | `25` | Budget cap in dollars |
| `LOOP_MAX_ITERATIONS` | `10` | Maximum iterations before pause |
| `LOOP_SHAPE` | `auto` | Force `tool` or `colleague` shape |

## Headless Behavior

When `LOOP_HEADLESS=true`:

- **Tool-shaped:** Default. Runs silently until completion or limit.
- **Colleague-shaped:** Disabled. Auto-escalates to tool-shaped.
- **Clarification requests:** Skipped. Works with provided spec as-is.
- **Pause prompts:** Replaced with structured exit codes.

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Completed successfully |
| `1` | Error during execution |
| `2` | Budget limit reached |
| `3` | Iteration limit reached |
| `4` | Circuit breaker triggered |
| `5` | Spec validation failed (score <5) |

## Output Artifacts

Loop generates artifacts in headless mode:

```
.loop/
├── state.json          # Final task state
├── iterations.jsonl    # Per-iteration log
└── summary.md          # Human-readable summary
```

### state.json

```json
{
  "taskId": "uuid",
  "status": "completed|paused|failed",
  "iteration": 8,
  "cost": 12.50,
  "completedSteps": ["..."],
  "remainingSteps": ["..."],
  "errors": []
}
```

### iterations.jsonl

One JSON object per line:

```json
{"iteration": 1, "step": "refactor api/users", "status": "success", "cost": 1.50}
{"iteration": 2, "step": "refactor api/auth", "status": "success", "cost": 1.75}
```

### summary.md

```markdown
# Loop Summary

**Status:** Completed
**Iterations:** 8/10
**Cost:** $12.50/$25.00

## Completed
- [x] Refactored api/users
- [x] Refactored api/auth
...

## Remaining
(none)
```

## GitHub Actions Integration

```yaml
- name: Run Loop
  uses: anthropics/claude-code-action@v1
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    prompt: |
      /loop:start
      Spec: ${{ github.event.issue.body }}
    max_turns: 50
    allowed_tools: "Read,Write,Edit,Bash,Glob,Grep,TaskCreate,TaskUpdate,TaskGet,TaskList"
  env:
    LOOP_BUDGET: "25"
    LOOP_MAX_ITERATIONS: "10"
    LOOP_HEADLESS: "true"
```

See `ci/github-action.yaml` for full example.

## GitLab CI Integration

```yaml
loop:
  script:
    - claude --print \
        --allowedTools "Read,Write,Edit,..." \
        "/loop:start Spec: ${LOOP_SPEC}"
  variables:
    LOOP_HEADLESS: "true"
    LOOP_BUDGET: "25"
```

See `ci/gitlab-ci.yaml` for full example.

## Best Practices

### Spec Clarity

CI specs lack interactive clarification. Write specs that score >=8:

**Bad (score ~5):**
```
Fix the authentication bug
```

**Good (score 9):**
```
Fix authentication bug where JWT tokens expire prematurely.

Success criteria:
- Tokens valid for 24 hours (was 1 hour)
- All auth tests pass
- No changes to token payload structure

Scope: src/auth/ only
```

### Budget Planning

Estimate iterations needed, set budget with margin:

| Task Complexity | Iterations | Suggested Budget |
|-----------------|------------|------------------|
| Single file fix | 2-3 | $10 |
| Multi-file refactor | 5-10 | $25 |
| Feature implementation | 10-20 | $50 |

### Error Recovery

On non-zero exit:

1. Check `.loop/state.json` for remaining work
2. Review `.loop/iterations.jsonl` for failure point
3. Fix blocker manually or improve spec
4. Re-trigger with `continue` flag or fresh run

### Security

- **API keys:** Use CI secrets, never commit
- **Allowed tools:** Restrict to minimum needed
- **Branch protection:** Loop creates branches, not direct commits
- **Review required:** Always require PR review for automated changes
