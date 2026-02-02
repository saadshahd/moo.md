---
name: verify
description: Define and execute machine-verifiable acceptance criteria. Use before building to lock criteria, after building to run verification. Triggers on "verify this works", "acceptance criteria", "how do we test", "prove it works", "machine-verifiable".
model: sonnet
allowed-tools: Read, Bash, Glob
---

# verify

Machine-verifiable over ambiguous. Acceptance criteria must be boolean.

## When to Use

| Trigger | Action |
| ------- | ------ |
| Before building feature | Lock acceptance criteria |
| After claiming "done" | Execute verification |
| User asks "how do we test this" | Define verification plan |
| Vague success criteria exist | Convert to boolean checks |
| Browser/UI verification needed | Use agent-browser workflow |

## Core Principle

> "Works correctly" is not a criterion. Exit codes, string presence, HTTP status—these are criteria.

Every acceptance criterion must be:
- **Boolean**: Pass or fail, no "partial"
- **Automated**: Runnable without human judgment
- **Specific**: One thing, not "works well"
- **Independent**: Fails alone, not with others

## Phase 1: Lock Criteria (Before Building)

### Criterion Types

| Type | Example | Verification Method |
| ---- | ------- | ------------------- |
| Exit code | Command returns 0 | `bash -c "cmd; echo $?"` |
| String presence | Output contains "Success" | `grep -q "Success"` |
| HTTP status | API returns 200 | `curl -s -o /dev/null -w "%{http_code}"` |
| File existence | Config file created | `test -f path/to/file` |
| JSON shape | Response has `.data.id` | `jq -e '.data.id'` |
| Element visible | Button appears on page | `agent-browser snapshot` + ref check |
| State change | Database row updated | Query before/after comparison |

### Criteria Template

```
## Acceptance Criteria

### Must Pass
1. [Criterion]: [Exact verification command]
2. [Criterion]: [Exact verification command]
3. [Criterion]: [Exact verification command]

### Must NOT
1. [Anti-criterion]: [How to verify absence]
2. [Anti-criterion]: [How to verify absence]

### Verification Method
Type: [execution output / observation / measurement]
Tool: [bash / agent-browser / curl / test framework]
```

## Phase 2: Execute Verification (After Building)

### CLI Verification

```bash
# Exit code check
command_here && echo "PASS" || echo "FAIL"

# String presence
output=$(command_here)
echo "$output" | grep -q "expected" && echo "PASS" || echo "FAIL"

# HTTP status
status=$(curl -s -o /dev/null -w "%{http_code}" URL)
[ "$status" = "200" ] && echo "PASS" || echo "FAIL"
```

### Browser Verification (agent-browser)

For UI/browser verification, use agent-browser CLI:

```bash
# 1. Open page
agent-browser open http://localhost:3000

# 2. Get interactive snapshot with refs
agent-browser snapshot -i

# 3. Verify element exists by ref
agent-browser get text @e1  # Get text of element

# 4. Interact if needed
agent-browser click @e2
agent-browser fill @e3 "test input"

# 5. Re-snapshot after interaction
agent-browser snapshot -i

# 6. Screenshot for evidence
agent-browser screenshot evidence.png

# 7. Close
agent-browser close
```

**Why agent-browser:**
- 93% less context than MCP servers
- No config required
- Accessibility-based refs (`@e1`) are stable
- Works via Bash (no MCP setup)

### Verification Output

```
## Verification Results

| Criterion | Command | Result | Evidence |
| --------- | ------- | ------ | -------- |
| [Criterion 1] | `[cmd]` | PASS/FAIL | [output or screenshot] |
| [Criterion 2] | `[cmd]` | PASS/FAIL | [output or screenshot] |

### Summary
- Total: X criteria
- Passed: Y
- Failed: Z

### Verdict
[ALL PASS → SHIP] or [ANY FAIL → list failures]
```

## Criterion Quality Checks

Before accepting criteria, verify:

```
[ ] Boolean? (not "works well", "looks good")
[ ] Automated? (no human judgment required)
[ ] Specific? (one thing per criterion)
[ ] Independent? (fails alone)
[ ] Fast? (< 30 seconds per check)
```

## Converting Vague to Boolean

| Vague | Boolean |
| ----- | ------- |
| "Works correctly" | "Returns exit code 0" |
| "Looks good" | "Element @login-btn visible in snapshot" |
| "Fast enough" | "Response time < 200ms" |
| "User can log in" | "After fill @email + fill @password + click @submit, snapshot contains 'Dashboard'" |
| "Data is saved" | "GET /api/item/123 returns 200 with body containing submitted values" |
| "Handles errors" | "Invalid input returns 400 with error.message present" |

## Anti-Patterns

| Bad | Good |
| --- | ---- |
| "Verify it works" | List specific boolean criteria |
| Manual verification for automatable checks | Script the check |
| "I looked and it seems fine" | Show command output |
| Criteria defined after building | Lock criteria before building |
| Single criterion for complex feature | One criterion per behavior |
| "The tests pass" | Show test output as evidence |

## Integration with gate

`verify` defines WHAT to check. `gate` defines WHEN to check.

```
verify (before building) → define criteria
  ↓
build feature
  ↓
gate (before claiming done) → triggers verify execution
  ↓
verify (after building) → execute and report
```

## Common Rationalizations (All Wrong)

| Thought | Reality |
| ------- | ------- |
| "This is too simple to need criteria" | Simple things break production too |
| "I'll know it when I see it" | Subjective ≠ verifiable |
| "The user will test it" | Your job to prove it works |
| "Tests cover this" | Show test output, not assumption |
| "It worked in dev" | Verify in target environment |
