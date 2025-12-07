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

## 4. Technical Requirements
[Stack, constraints, integrations]

## 5. Success Metrics
| Metric | Target | Measurement Method |
|--------|--------|-------------------|

## 6. Timeline & Milestones
[Phases with deliverables - no time estimates]

## 7. Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
```

## Rules

- Use the ask tool
- Do not proceed without user confirmation
- Challenge every feature: "Can we ship without this?"
- Default to cutting scope, not adding
