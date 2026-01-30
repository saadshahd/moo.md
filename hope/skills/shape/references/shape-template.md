# SHAPE.md Template

Template for `.loop/shape/SHAPE.md` — the iron-clad implementation spec.

---

## Template

```markdown
---
intent_ref: [hash or path to /intent output]
shaped: YYYY-MM-DDTHH:MM:SSZ
mode: present|autonomous
aspects:
  - visual
  - data
  - api
experts_consulted:
  visual: norman (7/10)
  data: hickey (8/10)
  api: fowler (8/10)
overall_confidence: 7/10
---

# Shape: [Task Name]

## Intent Summary

[One paragraph — the WHAT from /intent. Do not modify, quote directly.]

---

## Aspects

### Visual/UI

**Expert**: Don Norman — 7/10 confidence

#### Locked Decisions

| Decision | Value | Rationale |
|----------|-------|-----------|
| Layout | [specific structure] | [why this layout] |
| Empty state | [exact content/UI] | [why this approach] |
| Loading state | [skeleton/spinner/etc] | [why this pattern] |
| Error display | [how errors show] | [why this UX] |

#### Constraints (Must NOT)

- [ ] Must NOT show blank screen during any loading state
- [ ] Must NOT swallow errors without user feedback
- [ ] Must NOT break keyboard navigation flow
- [ ] Must NOT use color alone to convey information

#### Verification

```
□ Render with data=[] → empty state element visible
□ Render with loading=true → loading indicator visible
□ Trigger error → error message displayed to user
□ Tab through UI → all interactive elements reachable
```

---

### Data/Schema

**Expert**: Rich Hickey — 8/10 confidence

#### Locked Decisions

| Decision | Value | Rationale |
|----------|-------|-----------|
| Model | [exact schema with types] | [why this shape] |
| Immutability | [strategy] | [why immutable/mutable] |
| Relationships | [foreign keys, refs] | [why these relations] |
| Constraints | [validations] | [why these rules] |

#### Constraints (Must NOT)

- [ ] Must NOT allow mutation of [field] after creation
- [ ] Must NOT store derived data that can be computed
- [ ] Must NOT use nullable where required is intended
- [ ] Must NOT couple schema to UI representation

#### Verification

```
□ Migration runs without error
□ Insert invalid data → rejected by constraint
□ Query typical load → returns in <Xms
□ Schema matches documented model exactly
```

---

### API Design

**Expert**: Martin Fowler — 8/10 confidence

#### Locked Decisions

| Decision | Value | Rationale |
|----------|-------|-----------|
| Endpoint | [METHOD /path] | [why this resource design] |
| Request shape | [exact JSON] | [why these fields] |
| Response shape | [exact JSON] | [why this structure] |
| Error format | [status + body shape] | [why this pattern] |

#### Constraints (Must NOT)

- [ ] Must NOT expose internal implementation details
- [ ] Must NOT return [sensitive fields] without auth
- [ ] Must NOT accept unbounded input (pagination required)
- [ ] Must NOT mix concerns across endpoints

#### Verification

```
□ POST with valid payload → 201 + created resource
□ POST with invalid payload → 400 + error details
□ GET without auth (if protected) → 401
□ Response matches documented shape exactly
```

---

### [Additional Aspects as Discovered]

**Expert**: [Name] — N/10 confidence

#### Locked Decisions
| Decision | Value | Rationale |
|----------|-------|-----------|

#### Constraints (Must NOT)
- [ ] Must NOT ...

#### Verification
```
□ ...
```

---

## Loop Integration

### Success Criteria

Extracted from all aspect verifications above:

```json
[
  "Empty state renders when data=[]",
  "Loading indicator shows during fetch",
  "POST /api/X with valid payload returns 201",
  "Schema rejects invalid data",
  "All tests pass"
]
```

### Must NOT (Failure Conditions)

Extracted from all aspect constraints above:

```json
[
  "Blank screen during load",
  "Error swallowed silently",
  "Sensitive data exposed in response",
  "Schema allows invalid data through"
]
```

### Verification Commands

How to check each criterion (automatable where possible):

```json
{
  "Empty state renders when data=[]": "grep 'empty-state\\|no-data' src/components/*.tsx",
  "POST /api/X with valid payload returns 201": "curl -s -o /dev/null -w '%{http_code}' -X POST localhost:3000/api/X -H 'Content-Type: application/json' -d '{...}'",
  "Schema rejects invalid data": "npm test -- --grep 'validation'",
  "All tests pass": "npm test"
}
```

---

## Claude's Discretion

The following are **NOT locked**. Claude may choose freely:

- File organization and directory structure (within project conventions)
- Variable and function naming (within style guide)
- Test organization and grouping
- Implementation details not specified above
- Comments and inline documentation
- Import ordering and code formatting

**Principle**: Shape locks WHAT the implementation must achieve and constraints it must respect. Shape does NOT micromanage HOW Claude writes the code.

---

## Unresolved (Needs User Input)

[Only in Present mode. List any expert conflicts or ambiguities that require user decision.]

- [ ] [Question 1 — Expert A says X, Expert B says Y]
- [ ] [Question 2 — Unclear requirement needs clarification]

---

## Confidence Summary

| Aspect | Expert | Confidence | Notes |
|--------|--------|------------|-------|
| Visual/UI | Norman | 7/10 | Well-established patterns |
| Data/Schema | Hickey | 8/10 | Clear domain model |
| API Design | Fowler | 8/10 | Standard REST patterns |

**Overall**: 7/10 — High confidence, proceed with loop execution.

---

_Shaped: [timestamp]_
_Mode: [present/autonomous]_
_Ready for: /loop_
```

---

## Guidelines

### Locked Decisions

- Be specific: "3-column grid on desktop, single column on mobile" not "responsive layout"
- Include rationale: Decisions without WHY will be questioned
- Match expert's philosophy: Norman locks UX patterns, Hickey locks data shapes

### Constraints (Must NOT)

- Frame as observable failures: "Must NOT show blank screen" is testable
- Include implicit constraints: Security, accessibility, performance
- Don't over-constrain: Only lock what matters for quality

### Verification

- Prefer automatable checks: grep, curl, test commands
- Include manual checks when necessary: "Visually confirm layout"
- Map 1:1 to success criteria: Every criterion needs a verification method

### Claude's Discretion

- Explicitly list what's NOT locked
- Prevents over-interpretation of constraints
- Gives Claude room to write idiomatic code

### Unresolved

- Only in Present mode
- Autonomous mode picks simpler option and notes it
- Never block loop on philosophical debates
