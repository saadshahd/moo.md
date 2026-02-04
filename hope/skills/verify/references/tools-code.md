# Code Verification Tools

Reference catalog of verification tools. Actual tools used depend on [discovery](tool-discovery.md).

---

## Type Checking

### TypeScript (tsc)

**Detection:** `typescript` in package.json devDependencies

```bash
npx tsc --noEmit           # Full check
npx tsc --noEmit --incremental  # Quick tier
```

| Flag | Purpose |
|------|---------|
| `--noEmit` | Type check only, no output |
| `--incremental` | Fast re-checks (quick tier) |
| `--strict` | Full strictness (thorough tier) |

**Exit codes:** 0 = clean, 1 = errors

### mypy (Python)

**Detection:** `[tool.mypy]` in pyproject.toml or mypy in requirements

```bash
mypy .                  # Standard check
mypy . --strict         # Thorough tier
```

| Flag | Purpose |
|------|---------|
| `--strict` | Full type coverage |
| `--incremental` | Cache for speed |
| `--show-error-codes` | Identify error types |

**Exit codes:** 0 = clean, 1 = errors, 2 = fatal

### pyright

**Detection:** `pyright` in package.json or pyrightconfig.json exists

```bash
npx pyright
```

**Exit codes:** 0 = clean, 1 = errors

---

## Linting

### Biome (JS/TS)

**Detection:** `@biomejs/biome` in package.json

```bash
npx biome check .
```

| Flag | Purpose |
|------|---------|
| `--apply` | Auto-fix issues |
| `--no-errors-on-unmatched` | Ignore missing files |

**Exit codes:** 0 = clean, 1 = errors

### ESLint

**Detection:** `eslint` in package.json or .eslintrc* exists

```bash
npx eslint .
```

| Flag | Purpose |
|------|---------|
| `--max-warnings 0` | Fail on warnings |
| `--cache` | Speed up re-runs |

**Exit codes:** 0 = clean, 1 = errors, 2 = fatal

### Ruff (Python)

**Detection:** `[tool.ruff]` in pyproject.toml

```bash
ruff check .
```

| Flag | Purpose |
|------|---------|
| `--fix` | Auto-fix issues |
| `--select ALL` | All rules |

**Exit codes:** 0 = clean, 1 = errors

---

## Testing

### Vitest (JS/TS)

**Detection:** `vitest` in package.json

```bash
npx vitest run                    # Standard
npx vitest run --changed          # Quick tier
npx vitest run --coverage         # Thorough tier
```

| Flag | Purpose |
|------|---------|
| `run` | Single run (no watch) |
| `--changed` | Only changed files |
| `--coverage` | Generate coverage |
| `--reporter=json` | Machine-readable output |

**Exit codes:** 0 = all pass, 1 = failures

### Jest

**Detection:** `jest` in package.json or jest.config.* exists

```bash
npx jest
npx jest --onlyChanged           # Quick tier
npx jest --coverage              # Thorough tier
```

**Exit codes:** 0 = all pass, 1 = failures

### pytest (Python)

**Detection:** `[tool.pytest]` in pyproject.toml or pytest in requirements

```bash
pytest                    # Standard
pytest -x                 # Quick (fail fast)
pytest --cov              # Thorough
```

| Flag | Purpose |
|------|---------|
| `-x` | Stop on first failure |
| `--tb=short` | Concise tracebacks |
| `-q` | Quiet output |
| `--cov` | Coverage report |

**Exit codes:** 0 = pass, 1 = fail, 2 = interrupt, 3 = internal, 4 = usage, 5 = no tests

### Go

**Detection:** `go.mod` exists

```bash
go test ./...
go test -v ./...          # Verbose
go test -cover ./...      # Coverage
```

### Rust

**Detection:** `Cargo.toml` exists

```bash
cargo test
cargo test -- --nocapture  # Show output
```

---

## Using Project Scripts

**Prefer project scripts over direct tool invocation** when they exist:

```bash
# Check for scripts first
if jq -e '.scripts.test' package.json > /dev/null 2>&1; then
  npm test
elif jq -e '.devDependencies.vitest' package.json > /dev/null 2>&1; then
  npx vitest run
fi
```

Common script names to check:
- `test`, `test:unit`, `test:integration`
- `lint`, `lint:fix`
- `typecheck`, `type-check`, `check-types`
- `verify`, `check`

---

## No Tools Detected

If no verification tools are found:

1. Check for Makefile targets: `make test`, `make lint`, `make check`
2. Check for scripts in package.json or pyproject.toml
3. Ask user for verification commands
4. Document in `.loop/verify-config.json` for future runs
