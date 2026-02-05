# Task Decomposition

Break work into atomic, verifiable units.

## The "One Sentence Without And" Test

A task is atomic when you can describe it in ONE sentence without using "and".

**Good (atomic):**
- "Add import for ValidationError to auth.ts"
- "Write test for parseToken function"
- "Run npm test and capture output"
- "Create user validation schema file"

**Bad (too big):**
- "Implement authentication and add tests" (two actions)
- "Refactor the auth module" (vague, multiple actions)
- "Fix the bug and update documentation" (two actions)
- "Set up database and create migrations" (two actions)

## Task Schema

Each task is created via TaskCreate with this structure:

```
TaskCreate(
  subject="[imperative action] [specific target]",
  description="[detailed what to do, acceptance criteria]",
  activeForm="[present continuous for spinner display]"
)
```

**Examples by task type:**

```javascript
// File modification task
TaskCreate(
  subject="Add ValidationError import to auth.ts",
  description="Add `import { ValidationError } from './errors'` at top of src/auth.ts after existing imports. Verify: grep 'ValidationError' src/auth.ts shows import.",
  activeForm="Adding ValidationError import"
)

// Test creation task
TaskCreate(
  subject="Write test for parseToken edge cases",
  description="Create test in tests/auth.test.ts covering: valid JWT, expired JWT, malformed input. Each case should assert specific error type. Verify: npm test -- --grep parseToken passes.",
  activeForm="Writing parseToken tests"
)

// Verification task
TaskCreate(
  subject="Run full test suite",
  description="Execute npm test and capture output. All tests must pass. Verify: exit code 0, no failures in output.",
  activeForm="Running test suite"
)

// Refactor task
TaskCreate(
  subject="Extract validation logic to validateUser function",
  description="Move validation from createUser to new validateUser(data) function in src/validation.ts. Export function. Update createUser to call it. Verify: npm test passes, grep shows new function.",
  activeForm="Extracting validation logic"
)
```

## Dependency Mapping

After creating tasks, set dependencies:

```
TaskUpdate(taskId="4", addBlockedBy=["1", "3"])
```

Rules:
- Task A blocks Task B when B cannot start until A completes
- Independent tasks have no blockedBy → execute in same wave
- Minimize dependencies to maximize parallelism

## Decomposition Protocol

1. **Parse request** → Extract concrete deliverables
2. **List files** → What files need changes?
3. **For each file** → What specific changes?
4. **Apply test** → Can each change be described without "and"?
5. **Identify deps** → Which changes depend on others?
6. **Create tasks** → TaskCreate for each atomic unit
7. **Set blockedBy** → TaskUpdate for dependencies

## Size Guidelines

| Task Scope | Typical Tasks | Example |
|------------|---------------|---------|
| Single file change | 1-3 tasks | Add function, add import, add export |
| Feature addition | 3-8 tasks | Schema, migration, model, controller, test |
| Refactor | 5-15 tasks | Per-file changes, dependency updates |
| Large feature | 10-25 tasks | Break into smaller features first |

If > 25 tasks → decompose into multiple loops

## Verification Per Task

Each task description should include verification:

```
TaskCreate(
  subject="Write test for parseToken",
  description="Create test in tests/auth.test.ts that verifies parseToken handles valid JWT, expired JWT, and malformed input. Verify: `npm test -- --grep parseToken` passes",
  activeForm="Writing parseToken tests"
)
```

Verification types:
- **Command output** → `npm test`, `tsc --noEmit`, `eslint`
- **File presence** → File exists at expected path
- **Content check** → `grep` for expected content
- **HTTP response** → curl returns expected status
