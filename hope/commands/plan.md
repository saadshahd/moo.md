---
description: Start a task with full moo workflow. Surfaces unknowns, clarifies intent, searches libraries, assesses confidence, presents plan. Will NOT proceed until intent is clear.
---

# /plan

Start a task the moo way. **Will not proceed until ≥85% confident in intent.**

## Phase 1: Surface Unknowns

Before anything else, identify what's unclear.

**Ask yourself (silently):**

- What problem does this solve today?
- Who's the user and what's their journey?
- What's the simplest version that works?
- What would make this fail catastrophically?
- What constraints exist (tech, perf, compat)?
- What's been tried before?

**If confidence < 85%**, ask the user 3-5 targeted questions using the Ask tool:

- Open-ended (no yes/no)
- Designed to surface blind spots
- Cover: purpose, success criteria, constraints, edge cases

**Wait for answers before proceeding.**

## Phase 1b: Prime Skills

Once intent is ≥85% confident, invoke `/hope:prime` to select and load relevant skills for the task.

This ensures the right workflows and tools are in context before planning begins.

## Phase 2: Classify & Invert

Once intent is clear:

1. **Classify**: Build (A) / Debug (B) / Refactor (C)
2. **Invert**: List 3-5 failure modes with impact levels

```
## Failure Analysis
- [Mode]: [CATASTROPHIC/HIGH/MEDIUM/LOW]
```

## Phase 3: Library Search (Build tasks)

Search production libraries:

- npm / PyPI / crates.io
- Find ≥2 options OR justify why none exist
- Evaluate: downloads, maintenance, security

## Phase 4: Assess Confidence

State confidence as range:

- Apply novelty decay (first time = max 70%)
- Cite specific evidence

**Confidence gates:**

- < 70% → More research needed, don't recommend yet
- 70-85% → Can proceed with monitoring
- ≥ 85% → Ship with confidence

## Phase 5: Present Plan

```
## Intent
[What we're building and why - one sentence]

## Approach: Layer 0
[Simplest working version using production library]

## Failure Modes
- [Mode 1]: [Impact] - [Mitigation]

## Success Criteria
- [How we know it works]

---
[Quality Footer - see ../skills/soul/references/quality-footer.md]
```

## Phase 5b: Project-Level Planning (≥8 story points only)

For high-complexity tasks, add project-level controls:

```
### Kill Criteria
Conditions that stop the project:
1. [Specific measurable condition]
2. [Specific measurable condition]
3. [Specific measurable condition]

### Pivot Triggers
Signals requiring direction change:
1. [Observable signal]
2. [Observable signal]
3. [Observable signal]

### 48-Hour De-risking Test
Riskiest assumption: [Identify #1 risk]
Test: [Specific experiment to run]
Success criteria: [Measurable outcome]
Failure criteria: [Measurable outcome]
Pivot if fails: [Alternative direction]
```

## Phase 6: Wait

**Do not implement until user says "proceed".**

If user provides feedback, incorporate and re-present plan.

---

## Task

$ARGUMENTS
