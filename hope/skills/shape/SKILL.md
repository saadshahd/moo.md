---
name: shape
description: Shape implementation details through expert consultation before substantial builds. Auto-triggers after /intent when spec score ≥5, or when loop detects missing SHAPE.md. Produces iron-clad spec with locked decisions, constraints, and verification criteria. Two modes - present (shows reasoning) and autonomous (silent).
---

# Shape

Expert consultation to define HOW before building. Transforms intent (WHAT) into iron-clad implementation spec.

## When Shape Runs

| Trigger | Condition | Behavior |
|---------|-----------|----------|
| After /intent | spec_score ≥ 5 | Auto-trigger, shape the HOW |
| Loop start | .loop/shape/SHAPE.md missing | Run shape first, then loop |
| Manual | `/shape` | Explicit invocation |

**Blocking**: Substantial builds require SHAPE.md. No exceptions.

---

## Two Modes

### Present Mode (User in Session)

Show expert reasoning. User sees consultation happening.

```
[SHAPE] Analyzing intent for implementation aspects...

Discovered 4 aspects:
• Visual/UI → Norman
• Data/Schema → Hickey
• API Design → Fowler
• Error Handling → inferred expert

[SHAPE] Consulting in parallel...

━━━ Visual/UI — Norman (7/10) ━━━
"What does the empty state communicate?"

Locked: Empty state shows illustration + CTA
Must NOT: Blank screen during any state
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Additional experts...]

[SHAPE] Complete → .loop/shape/SHAPE.md
```

### Autonomous Mode (In Loop)

Silent. Write SHAPE.md and continue.

```
[SHAPE] Shaping (autonomous) → 4 aspects → 4 experts
[SHAPE] Complete → .loop/shape/SHAPE.md
[SHAPE] Criteria: 8 | Must-NOT: 4 | Confidence: 7/10
```

---

## Process

### 1. Receive Intent

Parse /intent output:
- Goal (outcome to achieve)
- Scope (boundaries)
- Constraints (limits)
- Success criteria (user's done definition)

### 2. Discover Aspects

Analyze intent for implementation dimensions:

```
□ Visual/UI      □ Data/Schema     □ API/Interface
□ Security       □ User Flows      □ Domain Logic
□ Performance    □ Error Handling  □ Testing
□ State Mgmt     □ Integration     □ Accessibility
```

Only discovered aspects get shaped. Don't force aspects that don't apply.

### 3. Route to Experts (Parallel)

For each aspect, select expert from counsel or infer:

| Aspect | Anchor Expert | Counsel Profile |
|--------|---------------|-----------------|
| Visual/UI | Norman | ✓ norman.md |
| Data/Schema | Hickey | ✓ hickey.md |
| Architecture | Fowler | ✓ fowler.md |
| API Design | Fowler | ✓ fowler.md |
| State Mgmt | Hickey | ✓ hickey.md |
| Performance | Hickey | ✓ hickey.md |
| Testing | Feathers | ✓ feathers.md |
| User Flows | Norman | ✓ norman.md |
| Error Handling | Hickey | ✓ hickey.md |
| Domain Logic | Fowler | ✓ fowler.md |
| CSS/Layout | Wathan | ✓ wathan.md |
| Accessibility | Soueidan | ✓ soueidan.md |

**No profile?** Use counsel's inference. Don't create new profiles.

### 4. Expert Consultation

Each expert provides (use counsel's consultation pattern):

**Locked Decisions** — "This MUST be X"
- Specific, concrete choices
- Include rationale (why X, not Y)

**Constraints** — "This must NOT do Y"
- Explicit anti-patterns
- Failure conditions

**Verification** — "Prove correct by checking Z"
- Automatable where possible
- Observable/measurable

**Confidence** — How certain (counsel's 1-10 scale)

### 5. Resolve Conflicts

When experts disagree, apply anchor hierarchy:

```
Hickey (simplicity)
  → Fowler (pragmatism)
    → Domain expert (context)
```

Ask: "What would Hickey say about this complexity?"
Ask: "What would Fowler say about this trade-off?"

If unresolvable → flag for user in Present mode, pick simpler option in Autonomous mode.

### 6. Synthesize SHAPE.md

Merge all expert outputs into `.loop/shape/SHAPE.md`:

- All locked decisions by aspect
- All constraints (must NOT)
- Success criteria array (for loop)
- Verification commands
- Claude's discretion areas (what's NOT locked)

---

## Output: .loop/shape/SHAPE.md

See `references/shape-template.md` for full template.

Key sections:

```markdown
---
intent_ref: [source]
shaped: [timestamp]
mode: present|autonomous
aspects: [list]
experts_consulted: {aspect: expert (confidence)}
overall_confidence: N/10
---

# Shape: [Task Name]

## Intent Summary
## Aspects (one section per discovered aspect)
  ### [Aspect]
  - Expert + confidence
  - Locked Decisions (table)
  - Constraints (must NOT)
  - Verification (checklist)

## Loop Integration
  - criteria[] (success conditions)
  - mustNot[] (failure conditions)
  - verification{} (how to check)

## Claude's Discretion
  - What is NOT locked

## Unresolved (if any)
```

---

## Loop Integration

Shape output feeds loop directly:

```
.loop/
├── state.json          # Loop execution state
└── shape/
    └── SHAPE.md        # Iron-clad spec
```

Loop reads on start:
- `criteria[]` → loop success criteria
- `mustNot[]` → circuit breakers (if true → pause)
- `verification{}` → how to check each criterion

### Criteria Extraction

From each aspect's verification checklist:

```json
{
  "criteria": [
    "Empty state renders when data=[]",
    "POST /api/X returns 201 with valid payload",
    "Schema rejects invalid data",
    "All tests pass"
  ]
}
```

### Must-NOT Extraction

From each aspect's constraints:

```json
{
  "mustNot": [
    "Blank screen during load",
    "Error swallowed silently",
    "Sensitive data in response"
  ]
}
```

Loop checks mustNot conditions. If ANY become true → pause immediately.

---

## Examples

### Example: "Build a comment system"

Intent gives: users can add/view comments on posts

Shape discovers:
- Visual/UI (comment display, input form)
- Data/Schema (Comment model, Post relation)
- API Design (CRUD endpoints)
- Error Handling (validation, failures)

Shape consults Norman, Hickey, Fowler in parallel.

Output locks:
- Empty state: "No comments yet — be the first!"
- Schema: Comment { id, postId, authorId, content, createdAt }
- API: POST /api/posts/:id/comments, GET /api/posts/:id/comments
- Errors: Inline validation, toast on save failure

Criteria for loop:
- Empty state visible when comments=[]
- POST returns 201 with new comment
- GET returns array sorted by createdAt desc
- Invalid content (empty/too long) returns 400

---

## Anti-Patterns

**Shaping what's already clear**
- If intent specifies exact API shape, don't re-shape it
- Shape fills gaps, doesn't override explicit decisions

**Over-consultation**
- Don't consult 10 experts for a simple feature
- Match expert count to complexity

**Blocking on unresolvable conflicts**
- In autonomous mode, pick simpler option and note it
- Don't pause loop for philosophical debates

**Vague locked decisions**
- Bad: "Use good error handling"
- Good: "Errors display inline below input with red text"

---

## References

- `references/shape-template.md` — Full SHAPE.md template
- `references/aspect-discovery.md` — How to identify aspects
- `references/anchor-experts.md` — Conflict resolution hierarchy
