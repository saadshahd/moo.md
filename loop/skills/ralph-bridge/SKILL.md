---
name: ralph-bridge
description: Execute Ralph prd.json stories with moo.md cognitive infrastructure. Wraps each story with Silent Audit, fit scoring, verification gates. Triggers on "ralph", "prd.json", "execute stories", or when prd.json exists in working directory.
---

# Ralph Bridge

Execute Ralph-style `prd.json` stories with moo.md cognitive infrastructure.

**What this does:** Reads `prd.json`, applies Silent Audit to each story, executes with verification gates, updates state, outputs Ralph completion signals.

---

## Pre-Flight Check

Before ANYTHING:

```
□ prd.json exists in working directory
□ Git branch matches prd.json branchName (or create it)
□ progress.txt exists (create if not)
□ Read progress.txt "## Codebase Patterns" section first
```

If prd.json missing: **STOP. Cannot proceed.**

---

## Story Selection

Find next story to execute:

```javascript
// Pseudocode
const story = prd.userStories
  .filter(s => s.passes === false)
  .sort((a, b) => a.priority - b.priority)[0];

if (!story) {
  // All done
  output("<promise>COMPLETE</promise>");
  exit(0);
}
```

---

## Silent Audit (Per Story)

BEFORE executing, score the story:

### Spec Score (from acceptance criteria)

| Dimension | Score | Evidence |
|-----------|-------|----------|
| Outcome | /2 | Does title + description specify what? |
| Scope | /2 | Is it ONE context-window sized change? |
| Constraints | /2 | Are there must-NOTs or boundaries? |
| Success Criteria | /2 | Are acceptance criteria verifiable? |
| Done Definition | /2 | Can we mechanically check completion? |
| **Total** | /10 | |

### Fit Score (delegation readiness)

| Dimension | Score | Evidence |
|-----------|-------|----------|
| Spec Clarity | /10 | Could write tests now? |
| Verification Cost | /10 | <5 min to verify? |
| Reversibility | /10 | Delete and retry ok? |
| Hidden Coupling | /10 | Isolated change? |
| Shape Confidence | /10 | Clear how to approach? |
| **Total** | /50 | |

### Decision Gate

| Condition | Action | Signal |
|-----------|--------|--------|
| Spec <5 | **STOP** | `<ralph-blocked reason="spec_unclear">US-XXX needs clarification</ralph-blocked>` |
| Fit <25 | **STOP** | `<ralph-blocked reason="fit_low">US-XXX not ready for automation</ralph-blocked>` |
| Fit 25-39 | Colleague mode | Execute but pause for review |
| Fit 40+ | Tool mode | Execute autonomously |

---

## Must-NOT Extraction

Before executing, derive must-NOTs from story context:

```
MUST-NOT (auto-derived):
- must NOT: modify files outside story scope
- must NOT: add features not in acceptance criteria
- must NOT: skip typecheck/tests
- must NOT: [story-specific from notes field]
```

If story.notes contains explicit must-NOTs, include them.

---

## Execution Protocol

### 1. Announce Start

```
[RALPH-BRIDGE] Story: US-XXX | Shape: [Tool/Colleague] | Fit: XX/50
```

### 2. Implement Story

Follow acceptance criteria exactly. No extras.

### 3. Run Quality Checks

```bash
# Whatever project uses
npm run typecheck  # or tsc
npm run lint       # if configured
npm test           # if tests exist
```

**If any fail:** Do NOT mark passes. Note failure in story.notes.

### 4. Verify Acceptance Criteria

For EACH criterion, verify with appropriate method:

| Criterion Type | Verification |
|----------------|--------------|
| "Typecheck passes" | Run typecheck, capture output |
| "Tests pass" | Run tests, capture output |
| "X exists in Y" | Grep/read file, show evidence |
| "UI shows X" | Browser screenshot if available |
| Code change | Show diff |

**Verification type must be execution/observation/measurement - NOT assumption.**

### 5. Commit

Only if ALL checks pass:

```bash
git add [specific files]
git commit -m "feat: [US-XXX] - [Story Title]"
```

### 6. Update prd.json

```javascript
story.passes = true;
story.notes = "[timestamp] Completed. [any learnings]";
```

### 7. Append to progress.txt

```markdown
## [Date/Time] - US-XXX

- **Implemented:** [summary]
- **Files changed:** [list]
- **Verification:** [method used, output]
- **Learnings:**
  - [pattern discovered]
  - [gotcha encountered]

---
```

### 8. Consolidate Patterns (if applicable)

If discovered a **reusable pattern**, add to `## Codebase Patterns` at TOP of progress.txt.

### 9. Append to moo.md learnings (if applicable)

If failure or discovery, write to:
- `~/.claude/learnings/discoveries.jsonl` for new patterns
- `~/.claude/learnings/failures.jsonl` for things that didn't work

---

## Completion Signals

### Story Complete, More Remain

```
[RALPH-BRIDGE] ✓ US-XXX complete | Remaining: N stories
```

### All Stories Complete

```
<promise>COMPLETE</promise>
```

### Blocked (cannot proceed)

```
<ralph-blocked reason="[spec_unclear|fit_low|verification_failed|stuck]">
[Story ID]: [Explanation of what's needed]

Suggested action: [what human should do]
</ralph-blocked>
```

---

## Colleague Mode Behavior

When fit 25-39, pause after implementation for review:

```
[RALPH-BRIDGE] ⏸ US-XXX implemented | Fit: XX/50 (Colleague)

Changes:
- [file1]: [summary]
- [file2]: [summary]

Verification pending:
□ [criterion 1]
□ [criterion 2]

Reply CONTINUE to verify and commit, or ROLLBACK to discard.
```

Wait for human input before marking passes.

---

## State Recovery

If session interrupted mid-story:

1. Check git status for uncommitted changes
2. Check prd.json for story state
3. Check progress.txt for last entry
4. Resume from last known good state

---

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Execute with spec <5 | Output blocked signal |
| Skip must-NOTs | Derive from context |
| Assume verification | Use execution output |
| Commit broken code | Fix or note in story.notes |
| Add unrequested features | Follow acceptance criteria exactly |
| Modify prd.json structure | Only touch passes/notes fields |

---

## Example Flow

```
$ claude --print < prompt.txt

[RALPH-BRIDGE] Reading prd.json...
[RALPH-BRIDGE] Branch: ralph/task-status ✓
[RALPH-BRIDGE] Story: US-002 | "Display status badge on task cards"

Silent Audit:
- Spec: 8/10 (clear outcome, verifiable criteria)
- Fit: 42/50 (isolated, easy verify, reversible)
- Shape: Tool ✓

Must-NOTs:
- must NOT: modify task creation logic
- must NOT: change database schema
- must NOT: add status values beyond spec

[RALPH-BRIDGE] Executing...
[implementation happens]

[RALPH-BRIDGE] Verifying...
- "Each task card shows colored status badge" → ✓ (browser screenshot)
- "Badge colors: gray/blue/green" → ✓ (code inspection + screenshot)
- "Typecheck passes" → ✓ (tsc output: 0 errors)

[RALPH-BRIDGE] Committing...
feat: [US-002] - Display status badge on task cards

[RALPH-BRIDGE] ✓ US-002 complete | Remaining: 2 stories
```

---

## Integration with moo-ralph.sh

This skill is designed to be called by an external bash loop. The bash loop:
1. Spawns fresh Claude Code instance with this skill
2. Detects completion/blocked signals
3. Handles Colleague-mode pauses
4. Continues or stops based on signals

See `scripts/moo-ralph.sh` for wrapper implementation.
