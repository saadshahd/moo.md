# State File Schemas

JSON schemas for moo's stateful data files.

## Schemas

| Schema | File Pattern | Used By |
|--------|--------------|---------|
| `workflow-state.schema.json` | `.loop/workflow-state.json` | loop plugin |
| `learnings.schema.json` | `~/.claude/learnings/*.jsonl` | hope/learn, hope/recall |

## Usage

These schemas document the expected structure of state files. They're used for:

1. **Documentation** — Understand what fields are required/optional
2. **Validation** — Hooks perform basic field existence checks
3. **Compatibility** — New fields must be optional to avoid breaking changes

## Validation

Hooks use lightweight jq-based validation (no external dependencies):

```bash
# Check required fields exist
jq -e '.version and .stage and .task' "$STATE_FILE"
```

Full JSON Schema validation is available for development but not enforced at runtime.

## Schema Evolution

- **version** field tracks breaking changes
- New fields must be optional (backward compatible)
- Breaking changes require version bump + migration in consuming hooks
- Document changes in CHANGELOG.md

## IDE Support

For schema autocompletion in VS Code, add to your state files:

```json
{
  "$schema": "../schemas/workflow-state.schema.json",
  "version": 1,
  "stage": "executing",
  "task": "..."
}
```
