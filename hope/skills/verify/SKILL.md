---
name: verify
description: Machine-verifiable acceptance criteria. Use before building to lock criteria, after building to verify. Triggers on "verify this works", "acceptance criteria", "prove it works".
model: opus
allowed-tools: Read, Bash, Glob, AskUserQuestion
---

# verify

> Acceptance criteria that machines can verify. "Works correctly" is not a criterion — exit codes, string presence, HTTP status are.

---

## Modes

| Mode | Purpose | When |
|------|---------|------|
| **Lock** | Convert criteria to boolean checks, discover tools, generate commands | Before building (after shape) |
| **Execute** | Run verification commands, collect evidence | After building (claiming done) |

---

## Tiers

| Tier | Definition | Budget | Tools |
|------|-----------|--------|-------|
| **Quick** | Smoke test — single fastest check | < 5s | Lint or type-check |
| **Standard** | All discovered checks + locked criteria | < 30s | Lint + types + tests |
| **Thorough** | All criteria + performance profiling + compliance | < 2min | Full suite + evidence |

---

## Phase 1: Tool Discovery

Detect before verifying. Never assume a tool exists.

| Signal | Check |
|--------|-------|
| `package.json` | `.scripts.test`, `.scripts.lint`, `.devDependencies` |
| `pyproject.toml` | `[tool.pytest]`, `[tool.ruff]` |
| `Cargo.toml` | `cargo test`, `cargo clippy` |
| `go.mod` | `go test`, `go vet` |
| `Makefile` | `make -qp \| grep '^test:'` |

Decision: If no tools found → `AskUserQuestion` for commands. If ambiguous → ask user to confirm.

---

## Phase 2: Lock Criteria

### Criterion Types

| Type | Verification |
|------|-------------|
| **Quantitative** | Exit code, HTTP status, count matches expected |
| **Qualitative** | String presence, JSON shape, file existence |
| **Behavioral** | Action produces expected side effect |
| **State** | System in expected state after operation |

### Output

Criteria locked in conversation. Format:

```
| # | Criterion | Boolean | Command | Tier |
|---|-----------|---------|---------|------|
| 1 | Login returns token | POST /auth → 200 with 'token' | curl ... | jq -e '.token' | standard |
| 2 | Invalid login fails | POST /auth bad creds → 401 | curl ... -w "%{http_code}" | standard |
| 3 | Tests pass | Suite exits 0 | npm test | thorough |
```

---

## Phase 3: Execute

### By Tier

- **Quick**: Run single fastest check. Report `[VERIFY:quick] PASS/FAIL (time)`.
- **Standard**: Run all discovered checks + locked criteria. Report per-check results.
- **Thorough**: Run all checks + criterion-specific commands. Collect evidence for each.

### Output Formats

```
[VERIFY:lock] Criteria locked | {N} criteria | Tools: {discovered}
```

```
[VERIFY:{tier}] {PASS/FAIL} {summary} ({time})
```

```
## Verification Report
| Criterion | Command | Result | Evidence |
|-----------|---------|--------|----------|
Total: X | Passed: Y | Failed: Z
Verdict: [ALL PASS → SHIP] or [ANY FAIL → list failures]
verification_type: execution output
```

---

## Integration Points

### After shape (lock criteria)

```
Skill(skill="hope:shape", args="")
→ Skill(skill="hope:verify", args="lock criteria from shape")
```

### During execution (quick checks)

```
Skill(skill="hope:verify", args="quick")
```

### Before claiming done (full verification)

```
Skill(skill="hope:verify", args="thorough")
→ Skill(skill="counsel:panel", args="verify outcomes for: {criteria}")
→ Skill(skill="hope:gate", args="verification passed")
```

---

## Anti-Patterns

- Assuming tools exist without checking project config
- Unmeasurable criteria ("works well", "looks good", "is fast")
- Same rigor for quick and thorough tiers
- Skipping verification when no tools found instead of asking user
- Showing verdict without evidence output

---

## Boundary

verify locks and executes machine-verifiable criteria. It does not define what to build (shape) or decide whether to ship (gate).
