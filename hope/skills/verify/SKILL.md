---
name: verify
description: Machine-verifiable acceptance criteria. Use before building to lock criteria, after building to verify. Triggers on "verify this works", "acceptance criteria", "prove it works".
model: sonnet
allowed-tools: Read, Bash, Glob, AskUserQuestion
---

# verify

Machine-verifiable acceptance criteria with tiered execution and tool discovery.

## Core Principle

> "Works correctly" is not a criterion. Exit codes, string presence, HTTP status—these are criteria.

Every acceptance criterion must be:
- **Boolean**: Pass or fail, no "partial"
- **Automated**: Runnable without human judgment (or explicit manual fallback)
- **Specific**: One thing, not "works well"
- **Independent**: Fails alone, not with others

---

## Modes

| Mode | When | Action |
|------|------|--------|
| **Lock** | Before building (after shape) | Convert criteria to boolean, discover tools, generate commands |
| **Execute** | After building (claiming done) | Run verification commands, collect evidence |

---

## Verification Tiers

| Tier | Budget | When | Purpose |
|------|--------|------|---------|
| **Quick** | < 5s | Mid-task, in-progress | Velocity — fastest check only |
| **Standard** | < 30s | After atomic task | Balance — catch obvious failures |
| **Thorough** | < 2min | Claiming done | Quality — prove with evidence |

See [tiers.md](references/tiers.md) for tier selection logic.

---

## Phase 1: Tool Discovery

**Before running any verification, discover what tools the project uses.**

### Discovery Protocol

1. Detect project type from config files
2. Extract verification commands from scripts
3. Fall back to common conventions
4. **Ask user if ambiguous or nothing found**

### Project Detection

| File | Project Type |
|------|--------------|
| `package.json` | Node.js / TypeScript |
| `pyproject.toml` | Python |
| `Cargo.toml` | Rust |
| `go.mod` | Go |
| `Makefile` | Check targets |

### Extract Commands

```bash
# Prefer project scripts
jq -r '.scripts.test // empty' package.json
jq -r '.scripts.lint // empty' package.json

# Detect tools from dependencies
jq -r '.devDependencies | keys[]' package.json | grep -E '^(vitest|jest|eslint|biome|typescript)$'
```

### When Nothing Detected

```
AskUserQuestion:
  question: "What verification commands should I run?"
  header: "Verify"
  options:
    - label: "npm test"
      description: "Run package.json test script"
    - label: "pytest"
      description: "Run Python tests"
    - label: "make test"
      description: "Run Makefile test target"
```

See [tool-discovery.md](references/tool-discovery.md) for full protocol.

---

## Phase 2: Lock Criteria (Before Building)

Convert each acceptance criterion to a boolean check with verification command.

### Criterion Types

| Type | Example | Verification |
|------|---------|--------------|
| Exit code | Command returns 0 | `cmd && echo PASS` |
| String presence | Output contains "Success" | `cmd \| grep -q "Success"` |
| HTTP status | API returns 200 | `curl -s -o /dev/null -w "%{http_code}"` |
| File existence | Config created | `test -f path/to/file` |
| JSON shape | Response has `.data.id` | `curl -s URL \| jq -e '.data.id'` |
| Element visible | Button on page | Screenshot + vision |

### Lock Output

```markdown
## Locked Criteria

| # | Criterion | Boolean | Command | Tier |
|---|-----------|---------|---------|------|
| 1 | Login returns token | POST /auth returns 200 with 'token' | `curl ... \| jq -e '.token'` | standard |
| 2 | Invalid login fails | POST /auth with bad creds returns 401 | `curl ... -w "%{http_code}"` | standard |
| 3 | Tests pass | Test suite exits 0 | `npm test` | thorough |

## Discovered Tools
- test: `npm test`
- lint: `npm run lint`
- types: `npx tsc --noEmit`
```

---

## Phase 3: Execute Verification (After Building)

Run verification based on tier.

### Quick Tier

```bash
# Single fastest check
npm run lint 2>&1 | head -20
echo "Exit: $?"
```

Output:
```
[VERIFY:quick] ✓ passed (2.1s)
```

### Standard Tier

```bash
# All discovered checks
npm run lint && npm run typecheck && npm test
```

Output:
```
[VERIFY:standard] ✓ All checks passed (18.4s)
  ✓ Lint: clean
  ✓ Types: clean
  ✓ Tests: 47 passed
```

### Thorough Tier

Run all checks + criterion-specific commands + evidence collection.

Output:
```
[VERIFY:thorough] ✓ SHIP — All criteria verified (1m 12s)

## Criteria Results
| Criterion | Result | Evidence |
|-----------|--------|----------|
| Login returns token | PASS | Response: {"token":"eyJ..."} |
| Invalid login fails | PASS | Status: 401 |
| Tests pass | PASS | 47/47 passed |

## Code Checks
✓ Lint: clean
✓ Types: clean
✓ Tests: 47/47 (coverage: 87%)

verification_type: execution output
confidence: ~92%
```

---

## Visual Verification

Only when criteria involve UI elements.

### Provider Selection

```
IF $GEMINI_API_KEY exists → Use Gemini (better at visuals, cheaper)
ELSE → Use Claude vision
On Gemini failure → Fallback to Claude
```

### If No Visual Framework

```
AskUserQuestion:
  question: "How should I verify the UI?"
  header: "Visual"
  options:
    - label: "I'll provide screenshots"
      description: "Take screenshots manually, share path"
    - label: "Skip visual verification"
      description: "Trust code changes are correct"
```

See [tools-visual.md](references/tools-visual.md) for visual verification.

---

## Integration Points

### After hope:shape

```
Skill(skill="hope:verify", args="lock criteria from shape")
```

Locks criteria as boolean, discovers tools, generates commands.

### After Atomic Task (Loop)

```
Skill(skill="hope:verify", args="quick")
```

Quick tier only — don't slow execution.

### Before Claiming Done

```
Skill(skill="hope:verify", args="thorough")
```

Full verification with evidence before gate.

See [integration-points.md](references/integration-points.md) for flow diagram.

---

## Expert Consultation

### For Verification Strategy

When locking criteria, optionally consult testing experts:

```
Skill(skill="counsel:panel", args="verification strategy for: {criteria}")
```

**Experts:** Beck (TDD), Fowler (testing patterns), Norman (UX verification)

### For Failure Diagnosis

When verification fails:

```
Skill(skill="counsel:panel", args="verification failed: {error}")
```

**Experts:** Hickey (root cause), Pike (debugging), Gregg (performance)

---

## Verification Output Format

### During Lock

```
[VERIFY:lock] Criteria locked | {N} criteria | Tools: {discovered}
```

### During Execute

```
[VERIFY:{tier}] {✓/✗} {summary} ({time})
```

### Final Report

```
## Verification Report

| Criterion | Command | Result | Evidence |
|-----------|---------|--------|----------|
| ... | ... | PASS/FAIL | ... |

### Summary
- Total: X criteria
- Passed: Y
- Failed: Z

### Verdict
[ALL PASS → SHIP] or [ANY FAIL → list failures]

verification_type: {execution output / observation / assumption}
```

---

## No Tools? No Problem.

When project has no verification tools configured:

1. **Check for scripts:** `npm test`, `make test`, etc.
2. **Generate curl commands:** For API criteria
3. **Ask user:** What commands to run
4. **Manual fallback:** List what to verify, ask user to confirm

```
[VERIFY:manual] Requires human verification

Please verify:
1. [ ] Login button visible on /login
2. [ ] Form submits without errors

Reply "verified" when confirmed.
```

---

## Anti-Patterns

| Bad | Good |
|-----|------|
| Assume tsc exists | Discover from package.json |
| Run vitest without checking | Check devDependencies first |
| Skip verification if no tools | Ask user for commands |
| Same rigor for quick and thorough | Tier-appropriate checks |
| "Tests pass" without output | Show test output as evidence |

---

## References

- [tiers.md](references/tiers.md) — Quick/Standard/Thorough definitions
- [tool-discovery.md](references/tool-discovery.md) — How to find project tools
- [tools-code.md](references/tools-code.md) — Code verification tools
- [tools-visual.md](references/tools-visual.md) — Visual verification tools
- [tools-api.md](references/tools-api.md) — API verification tools
- [tools-llm.md](references/tools-llm.md) — LLM output verification
- [integration-points.md](references/integration-points.md) — Where verify triggers
