---
name: gate
description: Verification before completion claims. Use when about to say "done", "fixed", or "complete". Triggers on completion language.
model: haiku
allowed-tools: Read
---

# gate

Verify before claiming completion.

## Trigger

Before claiming: "done", "fixed", "complete", "working", "ready"

---

## Pre-Work Gate (Before Starting)

Run before substantial work begins. Blocks execution if missing.

```
□ Verification method locked (not "assumption")
  → What type: execution output / observation / measurement?
  → What evidence will you show?

□ At least 2 "must NOT" criteria exist
  → What should this NOT do?
  → What scope should NOT expand?

□ Fit score determined workflow shape
  → <25: BLOCKED - clarify first
  → 25-29: Colleague-shaped (iterate each step)
  → 30-39: Tool-with-review (checkpoint major steps)
  → 40+: Tool-shaped (milestones only)
```

**If any unclear:** Pause here. Clarifying these now prevents rework later.

---

## Post-Work Gate (Before Claiming Done)

### Expert Review Check (Loop Integration)

When invoked after loop execution, check expert review status:

```
□ Thorough expert review passed?
  → Check .loop/workflow-state.json for reviews.thorough.passed
  → Must be true to proceed
  → If false: "⚠️ Expert review has {N} unresolved blockers. Resolve before gate."
```

If `reviews.thorough.passed` is false → resolve findings to ensure quality before proceeding.

### Verify Integration

Before running workflow-specific checks, ensure verify passed:

```
□ hope:verify thorough tier passed?
  → Check .loop/verify-config.json for results
  → All criteria must show PASS
  → Evidence must be captured
```

If verify not run or failed → address findings before completion to ensure quality.

---

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
| `reasoned inference` | Logic-based conclusion | ⚠️ Flag, don't block |
| `code review` | Inspection only | ⚠️ Weak |
| `assumption` | Not verified | ⚠️ Flag with warning |

Default: Require `execution output`, `observation`, or `measurement` before completion claims.

### Verification Tiers (from hope:verify)

| Tier | When | What Gate Expects |
|------|------|-------------------|
| Quick | Mid-task | Not checked by gate |
| Standard | After task | Passing status |
| Thorough | Before gate | Full evidence report |

Gate requires **thorough** tier results before allowing completion claim.

### Expert Review Requirement (Loop Integration)

When loop is active, gate also checks:

| Check | Source | Requirement |
|-------|--------|-------------|
| Thorough review | workflow-state.json | `reviews.thorough.passed = true` |
| Blockers resolved | workflow-state.json | `reviews.thorough.blockers_remaining = 0` |

If either fails → resolve review findings before completion to ensure quality.

### Boundary

**Gates advise, never prevent.** User owns their work.

- If user says "I'm confident" → flag concern, proceed
- If user says "skip gates" → proceed without verification demands
- Never invalidate user's assessment of their own work

Gate exists to surface risk, not to block legitimate intuition.

### Anti-Footgun Rules

- Never claim "done" with only assumptions
- "It compiles" is not verification
- "Tests pass" requires showing test output
- If verification would take > 15 min, that's a smell (task too big)

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

## Common Shortcuts to Avoid

These thoughts feel convincing but lead to missed issues:

| Thought | Better Approach |
|---------|-----------------|
| "The tests passed" | Tests are great — now show the actual execution output |
| "It should work" | Let's verify it actually works — run it and capture output |
| "I already checked" | Excellent — show me what you saw |
| "The user is waiting" | A few more seconds now saves rework later |
| "It's a simple change" | Simple changes deserve simple verification — quick to do |
| "I'm pretty sure it works" | Trust but verify — run it and we'll both be confident |
