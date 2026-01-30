# Ralph Repository Analysis: Deep Dive

> Analysis of [snarktank/ralph](https://github.com/snarktank/ralph) compared to moo.md

## What Ralph Actually Is

Ralph solves **context exhaustion** - when AI runs out of context mid-feature and produces broken code.

**Core mechanism:** A 113-line bash script (`ralph.sh`) that:
1. Reads `prd.json` for task list
2. Spawns a FRESH Claude Code/Amp instance
3. That instance implements ONE story, commits, marks `passes: true`
4. Loop detects `<promise>COMPLETE</promise>` or continues to next story
5. Repeat until all stories pass or max iterations hit

**Critical insight:** Each iteration is a NEW process with NO memory of previous iterations. Memory persists ONLY through:
- Git commits (code)
- `progress.txt` (append-only learnings)
- `prd.json` (task state)
- `AGENTS.md` files (directory-level docs)

This is fundamentally different from our `loop` plugin which runs within a single session.

---

## How The Mechanics Actually Work

### Ralph's Execution Flow (ralph.sh)

```bash
# Simplified ralph.sh logic:
for i in $(seq 1 $max_iterations); do
  # Spawn FRESH instance - no memory of previous iterations
  output=$(echo "$prompt" | claude --dangerously-skip-permissions --print)

  # Check for completion signal
  if echo "$output" | grep -q "<promise>COMPLETE</promise>"; then
    exit 0  # All stories done
  fi

  sleep 2  # Brief pause between iterations
done
```

**Key behavior:** Each iteration is isolated. The agent must:
1. Read `prd.json` to find next story with `passes: false`
2. Read `progress.txt` (especially `## Codebase Patterns` section) for context
3. Implement the story
4. Run quality checks (typecheck, tests)
5. Commit with format: `feat: [US-001] - Story Title`
6. Update `prd.json` to set `passes: true`
7. Append learnings to `progress.txt`

**Our loop plugin difference:** Runs in single session. State persists in memory + `.loop/state.json`. No fresh instances.

### Ralph's prd.json vs Our .loop/state.json

**Ralph's prd.json:**
```json
{
  "project": "TaskApp",
  "branchName": "ralph/task-status",
  "userStories": [
    {
      "id": "US-001",
      "title": "Add status field",
      "description": "As a developer, I need to store task status.",
      "acceptanceCriteria": [
        "Add status column with default 'pending'",
        "Typecheck passes"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

**Our .loop/state.json:**
```json
{
  "spec": "original user request verbatim",
  "criteria": ["tests pass", "all routes refactored"],
  "criteriaStatus": {
    "tests pass": false,
    "all routes refactored": true
  },
  "steps": ["step1", "step2"],
  "completedSteps": ["step1"],
  "remainingSteps": ["step2"],
  "iteration": 2,
  "status": "in_progress"
}
```

**Key differences:**
| Aspect | Ralph | moo.md |
|--------|-------|--------|
| Granularity | Per-story with `passes` boolean | Per-criterion with `criteriaStatus` map |
| Visibility | User-editable, committed to repo | Internal, gitignored |
| Agent's notes | `notes` field per story | Not present |
| Branch tracking | `branchName` field | Not present |

**What Ralph does better:** The `notes` field lets agents leave breadcrumbs for future iterations. The `branchName` enables automatic archiving.

### 3. External Memory System (progress.txt + AGENTS.md)

Ralph persists knowledge outside context windows via:

| Layer | Purpose | Survives |
|-------|---------|----------|
| `progress.txt` | Iteration-specific learnings, append-only | Feature branch |
| `## Codebase Patterns` | Consolidated reusable patterns (top of progress.txt) | Feature branch |
| `AGENTS.md` | Directory-level documentation | Forever |

**moo.md strength:** We have `~/.claude/learnings/*.jsonl` with proper categorization (failures, discoveries, constraints, delegation). Ralph's approach is simpler but less structured.

### 4. Archiving Strategy

When switching features, Ralph automatically:
1. Detects branch name change via `.last-branch` file
2. Copies `prd.json` + `progress.txt` to `archive/YYYY-MM-DD-feature-name/`
3. Resets progress.txt with fresh header

**moo.md gap:** No equivalent archive/handoff mechanism between features.

### 5. XML Completion Signal

```
<promise>COMPLETE</promise>
```

This unique signal enables external detection of completion by bash. Unlikely to appear in normal code.

**moo.md approach:** We use `<loop-complete>` with criteria status - more verbose but more informative.

---

## What We Do That Ralph Misses (Critical Gaps in Ralph)

### 1. Pre-Execution Validation (Silent Audit)

**Ralph's approach:** Trust prd.json blindly. Execute immediately.

**Our approach (from `hope/skills/soul/SKILL.md`):**
```markdown
## Silent Audit (Run Before Every Response)

**Blocking items (force verdicts):**

| Check | Threshold | Action |
|-------|-----------|--------|
| Spec score | <5 | 🔴 RESEARCH → run /hope:intent |
| Fit score | <25 | 🔴 RESEARCH → clarify first |
| Verification | "assumption" | 🔴 RESEARCH → define method |
| High stakes + Reversibility <5 | Yes | Run adversarial pre-check |
```

**Why this matters:** Ralph spawns fresh instances that execute whatever `prd.json` says. If the PRD is bad, you get 10 iterations of bad code. Our Silent Audit catches bad specs BEFORE execution.

### 2. Shape Selection (Tool vs Colleague vs Blocked)

**Ralph's approach:** One mode - fully autonomous. No check-ins.

**Our approach (from `hope/skills/soul/references/fit-decision.md`):**
```markdown
| Total Score | Shape | Action |
|-------------|-------|--------|
| **≥40** | Tool-shaped | Delegate and forget |
| **25-39** | Colleague-shaped | Iterate together |
| **<25** | Not ready | Clarify first, don't delegate |
```

**Why this matters:** Some tasks need human check-ins. Ralph forces everything into autonomous mode. A task scoring 30 (ambiguous spec, hard to verify) will thrash for 10 iterations in Ralph. In our system, it triggers Colleague mode with check-ins.

### 3. Must-NOT Criteria (Scope Creep Prevention)

**Ralph's approach:** Only positive acceptance criteria.

**Our approach (from `hope/skills/intent/SKILL.md`):**
```markdown
ACCEPTANCE CRITERIA (7-12 bullets, 2+ "must NOT"):
- must NOT: add features not requested
- must NOT: modify unrelated files
```

**Why this matters:** AI agents tend to "improve" things. Must-NOT criteria explicitly constrain scope. Ralph agents can add unrequested features and still pass all acceptance criteria.

### 4. Verification Type Enforcement

**Ralph's approach:** "Verifiable criteria" (vague).

**Our approach (from `hope/skills/soul/SKILL.md`):**
```markdown
| Type | Sufficient for SHIP? |
|------|---------------------|
| `execution output` | ✓ Yes |
| `observation` | ✓ Yes |
| `measurement` | ✓ Yes |
| `code review` | ⚠️ Weak |
| `assumption` | ✗ Blocks SHIP |
```

**Why this matters:** Ralph says "Typecheck passes" is verifiable. But "Works correctly" is also verifiable (run it and see). Our system distinguishes STRONG verification (execution output) from WEAK verification (code review) and BLOCKS on assumption.

### 5. Stuck Detection & Recovery (Breakthrough)

**Ralph's approach:** If stuck, iteration fails. Next iteration tries again.

**Our approach (from `hope/skills/breakthrough/SKILL.md`):**
- Simplification Cascade
- Scale Game
- Meta-Pattern Recognition
- Assumption Inversion
- Constraint Removal
- Fresh Perspective

**Why this matters:** Ralph's fresh-instance approach means a stuck agent just fails and the next instance tries the same thing. We have structured techniques for breaking through.

### 6. Structured Learning (JSONL vs Text)

**Ralph's approach:**
```markdown
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- Learnings for future iterations
```

**Our approach:**
```jsonl
{"ts":"2026-01-30T10:00:00Z","context":"auth","failure":"null check missing","root_cause":"type guard not applied","prevention":"always use assertUser()"}
```

**Why this matters:** Ralph's learnings are append-only prose. Searching for "auth failures" requires reading the whole file. Our JSONL is queryable by context, filterable by type, and machine-processable.

---

## Patterns Worth Cherry-Picking (With Implementation Details)

### Pattern 1: Lettered MCQ for Rapid Clarification

**Ralph's technique (from `skills/prd/SKILL.md`):**
```markdown
1. What is the primary goal of this feature?
   A. Improve user onboarding experience
   B. Increase user retention
   C. Reduce support burden
   D. Other: [please specify]

2. Who is the target user?
   A. New users only
   B. Existing users only
   C. All users
   D. Admin users only

This lets users respond with "1A, 2C, 3B" for quick iteration.
```

**Our current intent skill (Step 1 Clarify Loop):**
```markdown
Use the Ask tool until you estimate ≥ 95% confidence you can ship the correct result.

Cover:
- Purpose
- Audience
- Must-include facts
- Success criteria
```

**Gap:** We ask open-ended questions. Ralph provides options. Options are faster.

**Concrete integration - add to `hope/skills/intent/SKILL.md` after Step 0c:**

```markdown
### 0d Rapid Clarification Format

When asking clarifying questions, use lettered options where possible:

```
1. [Question about scope/goal]
   A. [Option 1]
   B. [Option 2]
   C. [Option 3]
   D. Other: [specify]

2. [Question about constraints]
   A. [Option 1]
   B. [Option 2]
   C. Other: [specify]
```

User can respond: "1A, 2B" for rapid iteration.

**When to use MCQ format:**
- Scope decisions (minimal vs full)
- Target user selection
- Technology choices
- Priority ordering

**When NOT to use:**
- Open-ended requirements gathering
- Creative decisions
- Complex tradeoffs
```

**Philosophy alignment:** "Clarity before action" - same principle, faster execution.

### Pattern 2: The 2-3 Sentence Story Size Gate

**Ralph's rule (from `skills/ralph/SKILL.md`):**
> "Rule of thumb: If you cannot describe the change in 2-3 sentences, it is too big."

**Examples from Ralph:**

Right-sized:
- "Add a database column and migration"
- "Add a UI component to an existing page"
- "Add a filter dropdown to a list"

Too big (split these):
- "Build the entire dashboard" → schema, queries, UI, filters
- "Add authentication" → schema, middleware, login UI, session handling

**Our current PRD workflow (`product/skills/product/references/prd.md`):**
```markdown
### Features & Scope
- List essential features. Now challenge: can we ship without each one?
- If you could only keep TWO features, which would they be?
```

We challenge scope but don't have a **mechanical size gate**.

**Concrete integration - add to `product/skills/product/references/prd.md` in Phase 2:**

```markdown
### Story Size Gate

Before including a user story, apply the 2-3 sentence test:

**Can you describe this change in 2-3 sentences?**

| Test Result | Action |
|-------------|--------|
| Yes, easily | Story is right-sized |
| Requires paragraph | Split into smaller stories |
| "It depends..." | Definitely split |

**Split pattern:**
1. Schema/database changes first
2. Backend logic second
3. UI components third
4. Aggregations/dashboards last

No story should depend on a later story.
```

**Philosophy alignment:** "Proven over invented" - simple heuristic with evidence.

### Pattern 3: Dependency Ordering Enforcement

**Ralph's rule (from `skills/ralph/SKILL.md`):**
```markdown
## Story Ordering: Dependencies First

Stories execute in priority order. Earlier stories must not depend on later ones.

**Correct order:**
1. Schema/database changes (migrations)
2. Server actions / backend logic
3. UI components that use the backend
4. Dashboard/summary views that aggregate data

**Wrong order:**
1. UI component (depends on schema that does not exist yet)
2. Schema change
```

**Our current PRD workflow:** No explicit dependency ordering.

**Concrete integration - add to `product/skills/product/references/prd.md`:**

```markdown
### Story Dependency Validation

Before finalizing PRD, verify dependency order:

```
□ Schema stories come before backend stories
□ Backend stories come before UI stories
□ UI stories come before aggregation stories
□ No story references entities created in later stories
```

**Dependency order:**
| Priority | Layer | Examples |
|----------|-------|----------|
| 1 | Schema | Add column, create table, migration |
| 2 | Backend | Server action, API endpoint, service |
| 3 | UI | Component, form, display |
| 4 | Aggregation | Dashboard, report, summary |

**Anti-pattern detection:**
- Story mentions "the X we created earlier" → X must have lower priority number
- Story uses type/model not yet defined → dependency violation
```

**Philosophy alignment:** "Automatic over remembered" - system enforces, human doesn't have to remember.

### Pattern 4: The `notes` Field for Agent Memory

**Ralph's pattern:**
```json
{
  "id": "US-003",
  "title": "Add status toggle",
  "passes": false,
  "notes": ""  // Agent writes here
}
```

**How agents use it (from `CLAUDE.md`):**
> "If checks pass, commit ALL changes... Update the PRD to set `passes: true` for the completed story"

The `notes` field lets agents leave breadcrumbs:
- "Attempted X, didn't work because Y"
- "Found existing pattern in Z, using that"
- "Blocked by missing dependency, need US-002 first"

**Our current `.loop/state.json`:** No equivalent notes field.

**Concrete integration - add to loop state schema:**

```json
{
  "spec": "...",
  "criteria": [...],
  "criteriaStatus": {...},
  "notes": {
    "iteration_1": "Started with approach X",
    "iteration_2": "X failed, switched to Y",
    "iteration_3": "Y worked, also discovered Z"
  }
}
```

**Or simpler - append-only:**
```json
{
  "workLog": [
    {"iteration": 1, "action": "Tried X", "result": "failed", "reason": "..."},
    {"iteration": 2, "action": "Switched to Y", "result": "success"}
  ]
}
```

**Philosophy alignment:** "Signal over noise" - visible state, easy inspection.

### Pattern 5: Consolidated Patterns at TOP

**Ralph's pattern (from `CLAUDE.md`):**
```markdown
## Consolidate Patterns

If you discover a **reusable pattern** that future iterations should know,
add it to the `## Codebase Patterns` section at the TOP of progress.txt:

## Codebase Patterns
- Example: Use `sql<number>` template for aggregations
- Example: Always use `IF NOT EXISTS` for migrations
- Example: Export types from actions.ts for UI components

Only add patterns that are **general and reusable**, not story-specific details.
```

**Why TOP matters:** Fresh agent instances read progress.txt from the top. Patterns surface FIRST, before iteration-specific noise.

**Our current recall skill:** Reads from `~/.claude/learnings/*.jsonl` but doesn't consolidate patterns to a priority position.

**Concrete integration - add to `hope/skills/recall/SKILL.md`:**

```markdown
### Pattern Consolidation

When surfacing learnings, organize by type:

**Priority 1 - Codebase Patterns (surface first):**
- Entries tagged with `applies_to: "all"` or matching current context
- Confidence ≥ 0.9
- Cited in multiple sessions

**Priority 2 - Recent Discoveries:**
- Last 30 days
- Confidence ≥ 0.8

**Priority 3 - Historical Failures:**
- Similar context tags
- Still relevant (not superseded)

### Output Format

```
## Consolidated Patterns (high-confidence, reusable)
- [pattern 1]
- [pattern 2]

## Recent Discoveries (context-relevant)
- [discovery with source session]

## Past Failures to Avoid
- [failure with prevention]
```
```

**Philosophy alignment:** "Depth over surface" - distilled wisdom before raw data.

### Pattern 6: Archive on Branch Switch

**Ralph's mechanism (from `ralph.sh`):**
```bash
# Check if branch changed
current_branch=$(jq -r '.branchName' prd.json 2>/dev/null || echo "")
last_branch=$(cat .last-branch 2>/dev/null || echo "")

if [[ -n "$last_branch" && "$current_branch" != "$last_branch" ]]; then
  # Archive previous run
  archive_dir="archive/$(date +%Y-%m-%d)-${last_branch#ralph/}"
  mkdir -p "$archive_dir"
  cp prd.json progress.txt "$archive_dir/"

  # Reset progress.txt
  echo "# Progress Log" > progress.txt
fi

echo "$current_branch" > .last-branch
```

**Our current loop:** No archiving. `.loop/state.json` is overwritten.

**Concrete integration - add to loop hooks:**

```bash
# hooks/pre-loop-start.sh
current_branch=$(git branch --show-current)
last_branch=$(cat .loop/.last-branch 2>/dev/null || echo "")

if [[ -n "$last_branch" && "$current_branch" != "$last_branch" ]]; then
  archive_dir=".loop/archive/$(date +%Y-%m-%d)-${last_branch}"
  mkdir -p "$archive_dir"
  cp .loop/state.json "$archive_dir/" 2>/dev/null || true
  echo "Archived previous loop state to $archive_dir"
fi

echo "$current_branch" > .loop/.last-branch
```

**Philosophy alignment:** "Automatic over remembered" - no data loss on context switch.

---

## Patterns to Avoid

### 1. No Confidence Gates

Ralph trusts specs blindly. Bad specs → bad execution.

**Keep:** Our Silent Audit with blocking gates.

### 2. Unstructured Learnings

Ralph's progress.txt is append-only text with no categorization.

**Keep:** Our JSONL with categories and metadata.

### 3. Single Execution Mode

Ralph has only "autonomous" mode. No hybrid for ambiguous tasks.

**Keep:** Our Tool/Colleague/Intent shape selection based on fit score.

### 4. No Must-NOT Criteria

Ralph only has positive acceptance criteria.

**Keep:** Our 2+ must-NOT requirement in gate skill.

---

---

## Implementation Priority Matrix

| Pattern | Effort | Value | Priority |
|---------|--------|-------|----------|
| MCQ clarification format | Low (add section to intent) | High (faster clarification) | **P0** |
| 2-3 sentence story gate | Low (add section to PRD) | High (prevents oversized stories) | **P0** |
| Dependency ordering validation | Medium (add validation logic) | High (prevents broken PRDs) | **P1** |
| `notes` field in loop state | Low (schema change) | Medium (better debugging) | **P1** |
| Pattern consolidation in recall | Medium (sorting logic) | Medium (better context) | **P2** |
| Branch-switch archiving | Medium (hook implementation) | Medium (data preservation) | **P2** |

---

## Architectural Comparison

```
RALPH ARCHITECTURE:
┌─────────────────────────────────────────┐
│ ralph.sh (bash loop)                    │
│   ↓ spawns fresh instance               │
│ ┌─────────────────────────────────────┐ │
│ │ Claude Code (no memory)             │ │
│ │   reads: prd.json, progress.txt     │ │
│ │   writes: code, commits, prd.json   │ │
│ │   outputs: <promise>COMPLETE</...>  │ │
│ └─────────────────────────────────────┘ │
│   ↓ detects signal or continues        │
│ (repeat for max_iterations)            │
└─────────────────────────────────────────┘

MOO.MD ARCHITECTURE:
┌─────────────────────────────────────────┐
│ Single Claude Code session              │
│ ┌─────────────────────────────────────┐ │
│ │ Silent Audit (pre-check)            │ │
│ │   ↓ blocks if fit <25               │ │
│ │ ┌─────────────────────────────────┐ │ │
│ │ │ loop plugin (iteration)         │ │ │
│ │ │   state: .loop/state.json       │ │ │
│ │ │   memory: session + JSONL       │ │ │
│ │ │   shape: tool/colleague/blocked │ │ │
│ │ └─────────────────────────────────┘ │ │
│ │   ↓ outputs <loop-complete>         │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Key difference:** Ralph's fresh-instance approach is simpler but loses in-session context. Our single-session approach maintains context but can exhaust on large features.

**Hybrid opportunity:** Use Ralph's bash loop to spawn our loop plugin repeatedly. Each iteration gets Silent Audit + shape selection + JSONL learnings, but fresh context window.

---

## What We Should NOT Adopt

| Ralph Pattern | Why We Skip It |
|---------------|----------------|
| Blind execution | Our Silent Audit catches bad specs BEFORE wasting iterations |
| Single autonomous mode | Shape selection prevents thrashing on ambiguous tasks |
| Positive-only criteria | Must-NOT prevents AI scope creep |
| Unstructured learnings | JSONL is queryable; prose is not |
| No stuck recovery | Breakthrough techniques beat "fail and retry" |

---

## Final Verdict

**Ralph is good at:** External orchestration, simple task format, fresh-context isolation, branch-aware archiving.

**moo.md is good at:** Pre-execution validation, shape selection, verification enforcement, structured learning, stuck recovery.

**Integration strategy:**
1. Adopt Ralph's tactical patterns (MCQ, story sizing, ordering, archiving)
2. Keep our cognitive infrastructure (Silent Audit, fit scoring, must-NOT)
3. Consider hybrid architecture (Ralph's bash loop + our loop plugin per iteration)

The patterns are complementary. Ralph's simplicity in orchestration can wrap our depth in execution.

---

*Analysis completed 2026-01-30*
