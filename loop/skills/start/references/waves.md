# Wave Execution

Parallel task execution using Claude Code's TaskList API.

## What is a Wave?

A **wave** is a group of tasks that can execute in parallel because they have no mutual dependencies.

```
Wave 1: [T-001, T-002, T-003]  ← No blockedBy, all run in parallel
         ↓        ↓        ↓
Wave 2: [T-004, T-005]         ← Blocked by Wave 1 tasks
              ↓
Wave 3: [T-006]                ← Blocked by Wave 2 tasks
```

## Wave Detection Protocol

1. **TaskList()** → Get all tasks
2. **Filter pending** → status = "pending"
3. **Filter unblocked** → blockedBy is empty OR all blockedBy tasks are completed
4. **Current wave** → All tasks matching both filters

```
# Pseudo-algorithm
def get_current_wave():
    all_tasks = TaskList()
    pending = [t for t in all_tasks if t.status == "pending"]
    unblocked = [t for t in pending if all(b.status == "completed" for b in t.blockedBy)]
    return unblocked
```

## Parallel Subagent Execution

Claude Code executes multiple Task tool calls in a single message in parallel.

**Wave execution:**
```
# Single message with multiple Task calls = parallel execution
Task(prompt="Execute task 1: ...", subagent_type="general-purpose")
Task(prompt="Execute task 2: ...", subagent_type="general-purpose")
Task(prompt="Execute task 3: ...", subagent_type="general-purpose")
```

Each subagent:
1. Reads task details
2. Executes the work
3. Verifies completion
4. Returns result

## Wave Execution Protocol

```
LOOP:
  1. wave_tasks = get_current_wave()

  2. IF wave_tasks is empty AND pending_tasks exist:
       → Stuck state (circular dependencies or failed tasks)
       → Invoke counsel:panel for unblocking

  3. IF wave_tasks is empty AND no pending_tasks:
       → All done, exit loop

  4. FOR each task in wave_tasks:
       TaskUpdate(taskId, status="in_progress")

  5. Spawn parallel subagents (one Task call per task)

  6. Wait for all subagents to complete

  7. FOR each completed task:
       - IF success: TaskUpdate(taskId, status="completed")
       - IF failed: increment stuckCount in metadata

  8. Update PROGRESS.md

  9. GOTO 1
```

## Subagent Prompt Template

```
Execute this task and verify completion:

**Task:** {subject}

**Details:** {description}

**Verification:** After completing, run the verification command and confirm it passes.

**Rules:**
- Do exactly what the task describes
- Report actual output from verification
- If blocked or failed, explain why clearly
```

## Progress Tracking

Update `.loop/PROGRESS.md` after each wave:

```markdown
# Loop Progress: {goal}

**Status:** Wave {N} of {total} | Iteration {i} | Cost: ${spent}/${budget}

## ✅ Completed (Wave 1-N)
- [x] T-001: {subject}
- [x] T-002: {subject}

## 🔄 In Progress (Wave N+1)
- [ ] T-003: {subject} (assigned to subagent)

## ⏳ Pending
- [ ] T-004: {subject} (blocked by T-003)

## 📊 Metrics
- Tasks: {completed}/{total}
- Stuck count: {n}
- Counsel consulted: {yes/no}
```

## Handling Stuck Tasks

When a task fails (verification doesn't pass):

1. **First failure** → Increment `stuckCount` in task metadata
2. **stuckCount >= 1** → Immediately invoke counsel:panel
3. **Apply recommendation** → Update task description or approach
4. **Retry** → Re-execute with new approach
5. **Continued failure** → Only pause at max iterations

No human escalation during loop — only pause when:
- Max iterations reached
- User manually cancels

## TaskList Persistence

Tasks persist to: `~/.claude/tasks/{CLAUDE_CODE_TASK_LIST_ID}/`

Set task list ID before starting:
```bash
export CLAUDE_CODE_TASK_LIST_ID=my-feature-loop
```

Resume across sessions by using same ID.

## Wave Size Guidelines

| Wave Size | Recommended | Notes |
|-----------|-------------|-------|
| 1-3 tasks | Ideal | Low coordination overhead |
| 4-6 tasks | Good | Reasonable parallelism |
| 7+ tasks | Split | Consider smaller waves |

Larger waves increase:
- Context per subagent
- Coordination complexity
- Risk of conflicts
