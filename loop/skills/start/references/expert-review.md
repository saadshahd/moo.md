# Expert Review Protocol

Expert-driven code review integrated into loop execution.

---

## Dimension → Expert Mapping (Clarification)

For spec dimensions scoring <2, invoke counsel:panel with these experts:

| Dimension | Experts | Focus |
|-----------|---------|-------|
| **Outcome** | Jobs, Graham, Kay, Victor | Vision, impact, what "done" looks like |
| **Scope** | Fowler, Hickey, Feathers, Alexander | Boundaries, simplicity, patterns |
| **Constraints** | Pike, Osmani, Hightower, Gregg | Engineering limits, performance, ops |
| **Success** | Norman, Majors, Zhuo, Beck | Quality, observability, UX, testing |
| **Done** | Cagan, Humble, Newman | Delivery, release criteria, ship gates |

**Extended Aspects:**

| Aspect | Experts |
|--------|---------|
| **Design** | Norman, Zhuo, Frost, Alexander |
| **UI** | Abramov, Osmani, Perry, Wathan |
| **UX** | Norman, Zhuo, Victor, Case |
| **Innovation** | Jobs, Kay, Victor, Matuschak |

---

## Review Tiers

| Tier | When | Duration | Purpose |
|------|------|----------|---------|
| **Light** | After each wave | ~30s | Quick idiomaticity check, non-blocking |
| **Thorough** | Before gate | ~2min | Full review, blockers must resolve |

---

## Expert-to-Aspect Mapping

### Light Review (2-3 experts per wave)

Select experts based on task aspects in the wave:

| Aspect | Primary Expert | Secondary |
|--------|---------------|-----------|
| API Design | Fowler | Fielding |
| State Management | Hickey | Abramov |
| Testing | Beck | Freeman |
| Performance | Gregg | Osmani |
| UI/UX | Norman | Zhuo |
| Security | OWASP | Pike |
| Error Handling | Nygard | Pike |
| Architecture | Martin | Evans |

### Thorough Review (3-4 experts)

Full panel based on all aspects touched during loop:

| Review Category | Experts |
|-----------------|---------|
| **Idiomaticity** | Language/framework specialists (Hickey, Abramov, etc.) |
| **Cleanliness** | Fowler, Martin, Beck |
| **Delivery** | Cagan, Humble, Newman |
| **Constraints** | Check against mustNot from SHAPE.md |

---

## Severity Levels

### BLOCKER
- **Definition:** Must fix before ship
- **Action:** Creates remediation task automatically
- **Examples:**
  - Security vulnerability (SQL injection, XSS)
  - Missing error handling on critical path
  - Violates explicit mustNot constraint
  - Breaks existing tests

### WARNING
- **Definition:** Should fix, but not blocking
- **Action:** Requires explicit acknowledgment
- **Examples:**
  - Non-idiomatic patterns
  - Missing edge case handling
  - Suboptimal performance (not critical)
  - Incomplete test coverage

### SUGGESTION
- **Definition:** Optional improvement
- **Action:** Informational only
- **Examples:**
  - Alternative approach worth considering
  - Potential future refactoring
  - Style preferences
  - Documentation improvements

---

## Light Review Protocol

After wave completion:

```
1. Identify aspects touched in this wave
2. Select 2-3 experts based on mapping
3. Invoke: Skill(skill="counsel:panel", args="review wave {N} changes for: {spec}")
4. Collect findings with severity
5. Output summary (non-blocking)
6. Persist to workflow-state.json
```

### Light Review Output

```
[LOOP] Wave {N} review: {score}/10 | {issues} issues ({blockers} blockers)
  - [SUGGESTION] Consider extracting validation to separate module
  - [WARNING] Missing null check on user.email

→ Continuing to next wave (non-blocking review)
```

---

## Thorough Review Protocol

Before gate, when all tasks complete:

```
1. Identify all aspects touched during loop
2. Select full expert panel (3-4 experts)
3. Invoke: Skill(skill="counsel:panel", args="thorough review for: {spec}")
4. Load SHAPE.md for mustNot constraints
5. Interactive review loop for each finding
6. Create remediation tasks for unresolved blockers
7. Loop back to wave execution if blockers exist
```

### Thorough Review Output

```
[LOOP] Thorough review starting...

Finding 1 of 5:
┌─ BLOCKER ────────────────────────────────────────┐
│ Auth token not invalidated on logout             │
├──────────────────────────────────────────────────┤
│ Guidance: Add token revocation in logout handler │
│ Constraint: ✓ Does not violate mustNot           │
└──────────────────────────────────────────────────┘
[Approve] [Create task] [Discuss] [Skip]
```

---

## Constraint-Aware Guidance

Before suggesting a fix, check against SHAPE.md mustNot:

```
1. Load .loop/shape/SHAPE.md
2. Extract mustNot constraints
3. For each suggested fix:
   - Check if fix violates any mustNot
   - If violation: mark as BLOCKED, suggest alternative
   - If clean: proceed with guidance
```

### Example: Constrained Guidance

```
Finding: "Consider using Redis for session storage"

Constraint check:
  mustNot: "no external dependencies"
  → BLOCKED - violates constraint

Alternative guidance:
  "Use in-memory store with file persistence instead"
  → Does not violate constraints ✓
```

---

## Review State Schema

Stored in `.loop/workflow-state.json`:

```json
{
  "reviews": {
    "wave_1": {
      "score": 8,
      "issues": 2,
      "blockers": 0,
      "experts": ["Fowler", "Beck"],
      "timestamp": "2026-02-05T10:15:00Z"
    },
    "wave_2": {
      "score": 7,
      "issues": 3,
      "blockers": 1,
      "experts": ["Hickey", "Abramov"],
      "timestamp": "2026-02-05T10:30:00Z"
    },
    "thorough": {
      "passed": false,
      "blockers_remaining": 1,
      "findings_total": 5,
      "experts": ["Fowler", "Beck", "Hickey"],
      "timestamp": "2026-02-05T10:45:00Z"
    }
  }
}
```

---

## Integration Points

### With counsel:panel

Light review:
```
Skill(skill="counsel:panel", args="review wave {N} changes: {files_changed}")
```

Thorough review:
```
Skill(skill="counsel:panel", args="thorough review for: {spec} with constraints: {mustNot}")
```

### With hope:gate

Gate checks `reviews.thorough.passed` before allowing completion:
- If false → Block gate, show remaining blockers
- If true → Proceed to verification
