# PRD Generation

Build a Product Requirements Document by asking the right questions and cutting scope ruthlessly.

## Phase 1: Context Dump

Ask the user to paste or describe their project overview—goals, users, features, constraints. Accept messy input.

## Phase 2: Interrogate

Work through these areas. Challenge assumptions. Push for scope cuts.

### Vision & Validation

- What problem are we solving? How do you know it's worth solving?
- Have you validated with real users, or are these assumptions?
- What's the smallest thing that solves the core problem?

### Users & Use Cases

- Who are the primary users? How well do you understand their pain?
- What's the single most critical use case for MVP?
- Which use cases add complexity without solving the core problem?

### Features & Scope

- List essential features. Now challenge: can we ship without each one?
- Which are truly Must-Have vs. Nice-to-Have?
- If you could only keep TWO features, which would they be?

### Technical Requirements

- What technical constraints exist?
- Are any choices over-engineering the MVP?

### Success Metrics

- How will you measure MVP success?
- What KPIs indicate we solved the core problem?

### Risks & Assumptions

- What are the top 3 risks?
- Is any feature based on unvalidated assumptions?
- Where is scope creep hiding?

## Phase 3: Summarize & Challenge

Summarize what you've learned. Highlight:

- Potential bloat in the MVP
- Unvalidated assumptions
- Features that could be cut

Ask: "Defend why each remaining feature must be included."

## Phase 4: Generate PRD

Only after user confirms, generate:

```
## 1. Executive Summary
[One paragraph: what, why, for whom]

## 2. Problem Statement
[The validated problem we're solving]

## 3. MVP Features
| Feature | Justification | Priority |
|---------|--------------|----------|
| [Name]  | [Why must-have] | P0/P1 |

## 4. Tasks
[8-15 granular tasks with acceptance criteria - see Task Explosion below]

## 5. Technical Requirements
[Stack, constraints, integrations]

## 6. Success Metrics
| Metric | Target | Measurement Method |
|--------|--------|-------------------|

## 7. Timeline & Milestones
[Phases with deliverables - no time estimates]

## 8. Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
```

---

## Task Explosion

Break features into **8-15 granular tasks**. If you have < 6 tasks, split further.

### One Concern Per Task

| Bad | Good |
|-----|------|
| "Test signup and fix issues" | T-001: Load page, T-002: Test inputs, T-003: Test submit, T-004: Identify issue, T-005: Implement fix, T-006: Verify fix |

### Investigation vs Implementation

Never combine "find the problem" with "fix the problem":

```
T-001: Check SignUp component configuration
T-002: Check middleware auth config
T-003: Implement fix based on T-001/T-002 findings
```

### Dependency Order

1. **Investigation tasks** (understand before changing)
2. **Schema/database changes**
3. **Backend logic changes**
4. **UI component changes**
5. **Verification tasks**

### Task Format

```markdown
### T-001: [Specific action verb] [specific target]
**Description:** What to do and why (1-2 sentences)

**Acceptance Criteria:**
- [ ] [Boolean pass/fail criterion]
- [ ] [Another criterion]
- [ ] Quality checks pass
```

---

## Machine-Verifiable Acceptance Criteria

Every criterion must be **boolean pass/fail**. An agent (or engineer) must be able to definitively verify without judgment.

### Patterns

| Type | Pattern | Example |
|------|---------|---------|
| Command | "Run `[cmd]` - exits with code 0" | "`npm test` exits 0" |
| File check | "File `[path]` contains `[string]`" | "`config.ts` contains `apiUrl`" |
| API | "[METHOD] `[url]` returns `[status]`" | "POST `/api/user` returns 201" |
| UI nav | "Navigate to `[url]` - `[element]` visible" | "/dashboard shows user name" |
| UI action | "Click `[element]` - `[result]`" | "Click Submit - redirects to /dashboard" |
| State | "`[variable]` equals `[value]`" | "`user.role` equals 'admin'" |
| Console | "Browser console shows no errors" | |

### Forbidden (Vague)

- "Works correctly"
- "Review the code"
- "Verify it looks good"
- "Document the findings"
- "Identify the issue"

### Good Examples

```markdown
**Acceptance Criteria:**
- [ ] File `src/auth/config.ts` contains `redirectUrl: '/onboarding'`
- [ ] Run `npm run typecheck` - exits with code 0
- [ ] Navigate to /signup - form renders with email and password fields
- [ ] POST /api/signup with valid data returns 200
- [ ] Click Submit with empty email - error message "Email required" appears
```

## Spec Clarity Rubric

Score each requirement before including in PRD:

| Dimension | 0-1 | 2-3 | 4-5 |
|-----------|-----|-----|-----|
| **Evidence** | Assumption | Anecdotal | Validated data |
| **Clarity** | Ambiguous | Mostly clear | Unambiguous, testable |
| **Dependency** | Blocked by unknowns | Some dependencies | Self-contained |

### Scoring

- **Evidence (0-5):** How validated is this requirement?
- **Clarity (1-5):** Can an engineer implement without questions?
- **Dependency (1-5):** How independent is this from other decisions?

### Gate

**Requirement must score ≥8 total to include in PRD.**

| Score | Action |
|-------|--------|
| < 6 | Reject — needs validation or clarification |
| 6-7 | Flag — include with explicit assumptions |
| ≥ 8 | Include — ready for implementation |

### Application

In Phase 2 (Interrogate), score each feature. In Phase 4 (Generate PRD), include only features that pass the gate.

```
| Feature | Evidence | Clarity | Dependency | Total | Status |
|---------|----------|---------|------------|-------|--------|
| [Name]  | 4        | 4       | 3          | 11    | ✓      |
| [Name]  | 2        | 3       | 2          | 7     | ⚠ Flag |
```

---

## Rules

- Use Ask tool
- Do not proceed without user confirmation
- Challenge every feature: "Can we ship without this?"
- Default to cutting scope, not adding
