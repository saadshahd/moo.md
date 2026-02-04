# Verification Tiers

Three tiers balance velocity with rigor. Select based on task state.

## Tier Selection Logic

```
IF task.status == "in_progress":
  tier = "quick"

ELIF task.status == "claiming_done" OR loop.stopping:
  tier = "thorough"

ELSE:
  tier = "standard"
```

---

## Quick Tier

**Budget:** < 5 seconds
**When:** Mid-task, in-progress work
**Purpose:** Velocity — don't slow down execution

### Characteristics

- Single fastest check from discovered toolchain
- Incremental/cached modes preferred
- Fail fast on obvious errors

### Output Format

```
[VERIFY:quick] ✓ passed (2.3s)
```

Or on failure:

```
[VERIFY:quick] ✗ failed
  ✗ [tool]: [error message]
```

---

## Standard Tier

**Budget:** < 30 seconds
**When:** After completing an atomic task
**Purpose:** Balance — catch obvious failures without blocking flow

### Characteristics

- All discovered checks run
- Full (non-incremental) mode
- Test suite if present

### Output Format

```
[VERIFY:standard] ✓ All checks passed (18.4s)
  ✓ Types: clean
  ✓ Lint: clean
  ✓ Tests: 47 passed
```

---

## Thorough Tier

**Budget:** < 2 minutes
**When:** Claiming done, loop stopping, gate check
**Purpose:** Quality — prove it works with evidence

### Characteristics

- All discovered checks + coverage
- Visual verification if UI changes
- API contract tests if integration
- Evidence captured for each criterion

### Required Evidence

- Test output with pass/fail counts
- Coverage percentage (if configured)
- Screenshot or element snapshot (for UI)
- API response samples (for integration)

### Output Format

```
[VERIFY:thorough] ✓ SHIP — All criteria verified (1m 42s)

## Evidence

### Code
✓ Types: clean
✓ Lint: clean
✓ Tests: 142/142 passed (coverage: 87%)

### Visual
✓ Login button: visible (screenshot: /tmp/verify/login.png)

### API
✓ POST /api/auth: 200 (schema validated)

## Verdict
verification_type: execution output
confidence: ~92%
```

---

## Tier Escalation

If quick tier fails, escalate to standard for more context.
If standard tier fails repeatedly (3x), escalate to thorough.

```
quick fail → standard (more diagnostics)
standard fail (3x) → thorough (full investigation)
```

---

## Check Categories by Tier

| Category | Quick | Standard | Thorough |
|----------|-------|----------|----------|
| Type check | Incremental | Full | Full + strict |
| Lint | Incremental/cached | Full | Full |
| Tests | Changed files only | Full suite | Suite + coverage |
| API | Health endpoint | Key endpoints | Contract + schema |
| Visual | — | Element presence | Screenshot diff |

**Note:** Actual commands depend on discovered toolchain. See [tool-discovery.md](tool-discovery.md).
