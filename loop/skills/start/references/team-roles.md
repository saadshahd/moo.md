# Team Roles for Loop Execution

Teammate specialization mapping for agent team mode.

---

## Role Selection by Aspect

| Aspect | Teammate Type | Tools |
|--------|---------------|-------|
| Implementation | general-purpose | All |
| Testing | general-purpose | Bash, Read, Edit, Write |
| Review | Explore | Read, Grep, Glob |
| Debugging | general-purpose | All |
| Documentation | general-purpose | Read, Write, Edit |

---

## Spawn Patterns

### Cross-Layer Feature

```
Frontend teammate → owns UI files
Backend teammate  → owns API/logic files
Test teammate     → owns test files
```

### Competing Hypotheses

```
Hypothesis A teammate → tests approach 1
Hypothesis B teammate → tests approach 2
Synthesizer lead      → aggregates findings
```

### Large Refactor

```
Module A teammate     → owns module A files
Module B teammate     → owns module B files
Integration teammate  → cross-module changes
```

---

## Delegation Protocol

Once spec is cleared (≥5), the loop runs humanless. counsel:panel provides both plan approval and work review gates.

### Lead Responsibilities

- TaskCreate (decomposition)
- TaskUpdate (assignment via owner field)
- Team coordination (SendMessage)
- Invoke counsel:panel to review teammate plans before execution
- Invoke counsel:panel to review teammate output after completion
- Progress tracking (PROGRESS.md)
- Final review aggregation
- Shutdown orchestration

### Teammate Responsibilities

- Execute assigned tasks (TaskUpdate status=in_progress)
- Verify completion
- Report via SendMessage
- Mark complete (TaskUpdate status=completed)
- Check TaskList for next work

---

## Shutdown Protocol

```
1. Lead checks all tasks completed (TaskList)
2. Lead runs thorough review (counsel:panel)
3. Lead runs hope:gate verification
4. Lead sends shutdown_request to all teammates
5. Teammates approve shutdown
6. Lead runs Teammate(operation="cleanup")
7. Lead updates workflow-state.json: shutdown_status → "completed"
8. Emit <loop-complete>
```
