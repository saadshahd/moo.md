---
name: gate
description: Verification before completion claims. Use when about to say "done", "fixed", or "complete". Runs checklist by workflow type with evidence requirements.
---

# gate

Verify before claiming completion.

## Trigger

Before claiming: "done", "fixed", "complete", "working", "ready"

## Workflow A: Build

```
□ Feature executes without errors (show output)
□ Edge cases tested (empty, null, boundary)
□ Rollback tested if Type 2B/1
□ Dependencies verified
```

## Workflow B: Debug

```
□ Root cause identified with evidence
□ Fix tested and resolves symptom
□ Prevention added (test/automation/guard)
□ Related bugs checked (same class)
```

## Workflow C: Refactor

```
□ Existing tests pass unchanged
□ Behavior identical (output comparison)
□ Deletion complete (no orphans)
□ No new abstraction without justification
```

## Verification Types

| Type | Description | Sufficient for SHIP? |
|------|-------------|---------------------|
| `execution output` | Ran command, showed result | ✓ Yes |
| `observation` | Screenshot, debugger session | ✓ Yes |
| `measurement` | Metrics, benchmark data | ✓ Yes |
| `code review` | Inspection only | ⚠️ Weak |
| `assumption` | Not verified | ✗ Blocks SHIP |

Require `execution output`, `observation`, or `measurement` before completion claims.

## Anti-Patterns

| Claim                      | Problem         | Required      |
| -------------------------- | --------------- | ------------- |
| "Should work"              | Speculation     | Actual output |
| "Looks good"               | No verification | Test results  |
| "Fixed the issue"          | No proof        | Before/after  |
| "I think this resolves it" | No confidence % | X-Y% + basis  |

## Incomplete Work

When blocked, state:

- What's done (with evidence)
- What's blocking (specific)
- What's remaining

## Type 2A Exception

Trivial changes (< 1 min rollback): completion allowed without full gate.
Document undo command.

## Common Rationalizations (All Wrong)

| Thought | Reality |
|---------|---------|
| "The tests passed" | Tests ≠ verification. Did you run the ACTUAL command? |
| "It should work" | "Should" = assumption. Show evidence. |
| "I already checked" | When? Show the output. |
| "The user is waiting" | Rushed verification = rework later. |
| "It's a simple change" | Simple changes break production too. |
| "I'm pretty sure it works" | Pretty sure ≠ evidence. Run it. |
