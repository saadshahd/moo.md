---
description: Debug using moo.md Workflow B. Five Whys to root cause, instrumentation, then fix. No workarounds.
---

# /debug

Systematic debugging: Effect → Cause → Root → Fix → Prevent.

## Phase 1: Understand the Symptom

**If unclear, ask:**
- What's the exact error message?
- When did this start happening?
- What changed recently?
- Can you reproduce it consistently?
- What have you already tried?

**Do not proceed until symptom is clear.**

## Phase 2: Five Whys (Root Cause Analysis)

Brainstorm 5-6 potential root causes:

```
## Potential Root Causes
1. [Cause]: X-Y% confident - [evidence]
2. [Cause]: X-Y% confident - [evidence]
3. [Cause]: X-Y% confident - [evidence]
4. [Cause]: X-Y% confident - [evidence]
5. [Cause]: X-Y% confident - [evidence]
```

For the most likely cause, ask "Why?" 5 times to reach the true root.

**All hypotheses < 70%?** → Request more context or add instrumentation.

## Phase 3: Verify Root Cause

Before fixing:
- Create minimal reproduction
- Gather evidence (logs, debugger, profiling)
- Reach ≥70% confidence in root cause

```
## Verified Root Cause (X-Y% confident)
[Explanation with specific evidence]
```

## Phase 4: Design Solution

Brainstorm 2-3 solutions:

```
## Solution Options
1. [Solution]: [Pros/Cons]
2. [Solution]: [Pros/Cons]
3. [Solution]: [Pros/Cons]

## Selected: [Solution N]
Rationale: [Why this one]
```

**Do not implement yet.**

## Phase 5: Plan Instrumentation

Define tracking metrics:
- How will we know the fix worked?
- What should we monitor?

## Phase 6: Implement

Only after root cause verified and instrumentation planned:

```
## Fix
[file:line changes]

## Prevention
[Structural change to prevent class of bugs]

## Verification
[How to confirm fix works]
```

---

[Quality Footer - see ../skills/soul/references/quality-footer.md]

---

## Issue

$ARGUMENTS
