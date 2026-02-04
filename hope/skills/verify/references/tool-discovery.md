# Tool Discovery

Discover verification tools from project configuration before running checks.

---

## Discovery Protocol

```
1. Detect project type from config files
2. Extract verification commands from scripts
3. Fall back to common conventions
4. Ask user if ambiguous or nothing found
```

---

## Project Type Detection

| File | Project Type |
|------|--------------|
| `package.json` | Node.js / JavaScript / TypeScript |
| `pyproject.toml` | Python (modern) |
| `setup.py` / `requirements.txt` | Python (legacy) |
| `Cargo.toml` | Rust |
| `go.mod` | Go |
| `Makefile` | Any (check targets) |
| `composer.json` | PHP |
| `Gemfile` | Ruby |

---

## Extracting Commands

### package.json

```bash
# Extract test command
jq -r '.scripts.test // empty' package.json

# Extract lint command
jq -r '.scripts.lint // empty' package.json

# Extract type check
jq -r '.scripts["type-check"] // .scripts.typecheck // empty' package.json

# Check for specific tools in devDependencies
jq -r '.devDependencies | keys[]' package.json | grep -E '^(vitest|jest|mocha|eslint|biome|typescript)$'
```

### pyproject.toml

```bash
# Check for pytest
grep -q '\[tool.pytest' pyproject.toml && echo "pytest"

# Check for ruff
grep -q '\[tool.ruff' pyproject.toml && echo "ruff"

# Check for mypy
grep -q '\[tool.mypy' pyproject.toml && echo "mypy"

# Check scripts section
grep -A5 '\[project.scripts\]' pyproject.toml
```

### Makefile

```bash
# List available targets
make -qp 2>/dev/null | grep -E '^[a-zA-Z_-]+:' | grep -E '(test|lint|check|verify)'
```

---

## Tool Categories

### Type Checking

| Tool | Detection | Command |
|------|-----------|---------|
| tsc | `typescript` in package.json | `npx tsc --noEmit` |
| mypy | `[tool.mypy]` in pyproject.toml | `mypy .` |
| pyright | `pyright` in package.json | `npx pyright` |

### Linting

| Tool | Detection | Command |
|------|-----------|---------|
| ESLint | `eslint` in package.json | `npx eslint .` |
| Biome | `@biomejs/biome` in package.json | `npx biome check .` |
| Ruff | `[tool.ruff]` in pyproject.toml | `ruff check .` |
| Flake8 | `flake8` in requirements | `flake8 .` |

### Testing

| Tool | Detection | Command |
|------|-----------|---------|
| Vitest | `vitest` in package.json | `npx vitest run` |
| Jest | `jest` in package.json | `npx jest` |
| pytest | `pytest` in pyproject.toml | `pytest` |
| go test | `go.mod` exists | `go test ./...` |
| cargo test | `Cargo.toml` exists | `cargo test` |

---

## Discovery Script

```bash
#!/bin/bash

TOOLS_FOUND=""

# Node.js project
if [ -f "package.json" ]; then
  echo "Detected: Node.js project"

  # Type checking
  if jq -e '.devDependencies.typescript' package.json > /dev/null 2>&1; then
    TOOLS_FOUND="$TOOLS_FOUND type:tsc"
  fi

  # Linting
  if jq -e '.devDependencies["@biomejs/biome"]' package.json > /dev/null 2>&1; then
    TOOLS_FOUND="$TOOLS_FOUND lint:biome"
  elif jq -e '.devDependencies.eslint' package.json > /dev/null 2>&1; then
    TOOLS_FOUND="$TOOLS_FOUND lint:eslint"
  fi

  # Testing
  if jq -e '.devDependencies.vitest' package.json > /dev/null 2>&1; then
    TOOLS_FOUND="$TOOLS_FOUND test:vitest"
  elif jq -e '.devDependencies.jest' package.json > /dev/null 2>&1; then
    TOOLS_FOUND="$TOOLS_FOUND test:jest"
  fi

  # Check for scripts
  TEST_SCRIPT=$(jq -r '.scripts.test // empty' package.json)
  LINT_SCRIPT=$(jq -r '.scripts.lint // empty' package.json)

  [ -n "$TEST_SCRIPT" ] && echo "  test script: $TEST_SCRIPT"
  [ -n "$LINT_SCRIPT" ] && echo "  lint script: $LINT_SCRIPT"
fi

# Python project
if [ -f "pyproject.toml" ]; then
  echo "Detected: Python project"

  grep -q '\[tool.mypy' pyproject.toml && TOOLS_FOUND="$TOOLS_FOUND type:mypy"
  grep -q '\[tool.ruff' pyproject.toml && TOOLS_FOUND="$TOOLS_FOUND lint:ruff"
  grep -q '\[tool.pytest' pyproject.toml && TOOLS_FOUND="$TOOLS_FOUND test:pytest"
fi

# Output discovered tools
if [ -n "$TOOLS_FOUND" ]; then
  echo "Tools found:$TOOLS_FOUND"
else
  echo "No tools auto-detected. Please specify verification commands."
fi
```

---

## Fallback: Ask User

When discovery fails or is ambiguous:

```
AskUserQuestion:
  question: "What verification commands should I run?"
  header: "Verify"
  options:
    - label: "npm test"
      description: "Run package.json test script"
    - label: "pytest"
      description: "Run Python tests with pytest"
    - label: "make test"
      description: "Run Makefile test target"
```

---

## Caching Discovery

Store discovered tools in `.loop/verify-config.json`:

```json
{
  "discovered_at": "2024-01-15T10:30:00Z",
  "project_type": "node",
  "tools": {
    "type": { "tool": "tsc", "command": "npx tsc --noEmit" },
    "lint": { "tool": "biome", "command": "npx biome check ." },
    "test": { "tool": "vitest", "command": "npx vitest run" }
  },
  "scripts": {
    "test": "npm test",
    "lint": "npm run lint"
  }
}
```

Re-discover if config files changed (check mtime).

---

## Priority Order

When multiple tools detected for same category:

1. **Use project scripts first** — `npm test` over `npx vitest`
2. **Prefer configured tools** — tools with config files
3. **Ask if still ambiguous** — multiple valid options
