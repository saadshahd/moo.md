# Verify Integration Points

Where and when verify triggers in the workflow.

---

## Integration Architecture

```
hope:intent
    ↓ (spec score ≥5)
hope:shape
    ↓ (extracts criteria)
    ↓
[INTEGRATION POINT 1: LOCK]
  → Convert criteria to boolean
  → Discover verification tools
  → Output verification commands per criterion
    ↓
loop:start (decomposition)
    ↓
Task execution
    ↓
[INTEGRATION POINT 2: QUICK]
  → After each atomic task
  → Quick tier only
    ↓
All tasks complete
    ↓
[INTEGRATION POINT 3: THOROUGH]
  → Before claiming done
  → Full verification with evidence
    ↓
hope:gate
    ↓
<loop-complete>
```

---

## Integration Point 1: Lock Criteria

**When:** After hope:shape generates SHAPE.md
**Trigger:** Shape output contains `criteria:` section
**Tier:** N/A (planning phase)

### What Happens

1. Extract criteria from SHAPE.md
2. Convert each to boolean verification
3. Run tool discovery for project
4. Generate verification command per criterion
5. Store in `.loop/verify-config.json`

### Skill Invocation

```
Skill(skill="hope:verify", args="lock criteria from shape")
```

### Output

```json
{
  "criteria": [
    {
      "text": "Login returns JWT token",
      "boolean": "POST /api/auth/login returns 200 with body containing 'token' field",
      "command": "curl -s -X POST http://localhost:3000/api/auth/login -d '{...}' | jq -e '.token'",
      "tier": "standard"
    }
  ],
  "tools_discovered": {
    "test": "npm test",
    "lint": "npm run lint",
    "types": "npx tsc --noEmit"
  }
}
```

---

## Integration Point 2: Quick Verify

**When:** After completing atomic task in loop
**Trigger:** TaskUpdate with status="completed"
**Tier:** Quick (< 5 seconds)

### What Happens

1. Run fastest discovered check (usually types/lint)
2. If fail → escalate to standard, don't mark task complete
3. If pass → proceed to next task

### Skill Invocation

```
Skill(skill="hope:verify", args="quick check after task completion")
```

### Output

```
[VERIFY:quick] ✓ passed (2.1s)
```

Or:

```
[VERIFY:quick] ✗ failed — escalating to standard
  ✗ Type error: Cannot find name 'foo'
```

---

## Integration Point 3: Thorough Verify

**When:** All tasks complete, before claiming done
**Trigger:** Loop about to emit `<loop-complete>`
**Tier:** Thorough (< 2 minutes)

### What Happens

1. Run all discovered checks
2. Execute verification command for each criterion
3. Capture evidence (output, screenshots, responses)
4. Generate verification report

### Skill Invocation

```
Skill(skill="hope:verify", args="thorough verification before completion")
```

### Output

```
[VERIFY:thorough] ✓ SHIP — All criteria verified (1m 12s)

## Criteria Results
| Criterion | Command | Result |
|-----------|---------|--------|
| Login returns JWT | curl ... | PASS |
| Invalid login returns 401 | curl ... | PASS |

## Code Checks
✓ Types: clean (npm run typecheck)
✓ Tests: 47/47 passed (npm test)

## Evidence
- API responses saved to .loop/evidence/
- Test output: [attached]

verification_type: execution output
```

---

## Integration with hope:gate

Gate checks verify results before allowing completion claim:

```
gate checklist:
□ verify:thorough passed?
  → Yes: proceed to completion
  → No: list failures, block completion
```

Gate reads `.loop/verify-config.json` to check:
- All criteria have verification commands
- All criteria passed in thorough tier
- Evidence captured for each

---

## Integration with counsel:panel

### For Verification Strategy

When locking criteria (Point 1), optionally consult testing experts:

```
Skill(skill="counsel:panel", args="verification strategy for: {criteria list}")
```

Experts: Beck (TDD), Fowler (testing patterns), Norman (user verification)

### For Failure Diagnosis

When verification fails, consult debugging experts:

```
Skill(skill="counsel:panel", args="verification failed: {error details}")
```

Experts: Hickey (simplicity), Pike (debugging), Gregg (performance)

---

## Skipping Verify

Verify can be skipped when:
- User says "skip verification"
- Task is Type 2A (trivial, < 1 min rollback)
- No verification tools discovered AND user declines to provide commands

Document skip reason in `.loop/PROGRESS.md`:

```
[VERIFY] Skipped: User requested, Type 2A change
```

---

## Manual Verification Fallback

When automated verification not possible:

```
[VERIFY:manual] Requires human verification

Please verify:
1. [ ] Login button visible on /login page
2. [ ] Form submits without errors
3. [ ] Dashboard shows after login

Reply "verified" when confirmed.
```
