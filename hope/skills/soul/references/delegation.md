# Delegation: Anti-Footgun Rules

Safe AI delegation practices with explicit gates and verification.

## Pre-Delegation Checklist

Before delegating to AI:

- [ ] Spec scores ≥8 on clarity rubric
- [ ] Verification method defined (not "I'll know it when I see it")
- [ ] Rollback plan exists (Type 2A or 2B)
- [ ] Success criteria are testable yes/no statements
- [ ] Failure modes identified (what could go wrong?)

## Delegation Anti-Patterns

| Anti-Pattern | Why It Fails | Fix |
|--------------|--------------|-----|
| "Make it better" | No success criteria | Define measurable improvement |
| "Fix all the bugs" | Unbounded scope | List specific bugs to fix |
| "Refactor this" | No target architecture | Describe desired end state |
| "Do what I mean" | Requires mind-reading | Explicit requirements |
| "Use best practices" | Subjective, varies | Cite specific standards |

## Safe Delegation Patterns

| Pattern | Example | Why It Works |
|---------|---------|--------------|
| **Bounded scope** | "Fix the null check on line 42" | Clear start and end |
| **Testable outcome** | "All tests in auth/ pass" | Objective verification |
| **Explicit constraints** | "No new dependencies" | Prevents scope creep |
| **Defined artifacts** | "Output: PR with tests" | Clear deliverable |

## Escalation Triggers

Stop and ask human if:

- Touching > 5 files unexpectedly
- Tests start failing
- Changing public APIs
- Modifying security-sensitive code
- Unclear which approach to take

## Review Cadence

| Delegation Shape | Review Points |
|------------------|---------------|
| Tool-shaped | On completion only |
| Colleague-shaped | After each iteration |
| High-stakes | Milestone approvals |
