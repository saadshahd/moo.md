# Spec Clarity Rubric

Score specs on 5 dimensions (0-2 each, max 10).

## Dimensions

| Dimension | 0 | 1 | 2 |
|-----------|---|---|---|
| **Outcome** | "Make it better" | "Improve performance" | "p95 latency <100ms" |
| **Scope** | "Fix the app" | "Fix auth" | "Fix JWT refresh in /api/auth/token" |
| **Constraints** | None stated | "Use existing stack" | "No new deps, TS only, <500 LOC" |
| **Success Criteria** | None stated | "Tests pass" | "All tests pass + manual QA on 3 flows" |
| **Done Definition** | Implied | "When it works" | "PR merged, deployed to staging" |

## Scoring Guide

**Outcome:** What should change?
- 0: Vague improvement
- 1: Named metric without target
- 2: Specific, measurable target

**Scope:** What code/systems?
- 0: Entire codebase
- 1: Named module/feature
- 2: Specific files/functions

**Constraints:** What must be preserved?
- 0: No constraints
- 1: General constraints
- 2: Explicit technical constraints

**Success Criteria:** How to verify?
- 0: No verification
- 1: Single verification method
- 2: Multiple verification methods

**Done Definition:** When is it complete?
- 0: Implied/assumed
- 1: Vague endpoint
- 2: Specific, observable endpoint

## Decision Rules

| Score | Shape | Action |
|-------|-------|--------|
| **8-10** | Tool | Proceed autonomously, report on completion |
| **5-7** | Colleague | Iterate together, check in after each step |
| **<5** | — | Run `/hope:intent` to clarify spec first |

## Examples

**Score 9 (Tool-shaped):**
> "Migrate all useState hooks in /components to use the new useStore pattern. No new dependencies. All existing tests must pass. Done when PR is ready for review."

- Outcome: 2 (clear pattern change)
- Scope: 2 (specific directory)
- Constraints: 2 (no new deps)
- Success: 2 (tests pass)
- Done: 1 (PR ready, not merged)

**Score 6 (Colleague-shaped):**
> "Improve the authentication flow"

- Outcome: 1 (improve, but what?)
- Scope: 1 (auth, but which parts?)
- Constraints: 0 (none stated)
- Success: 2 (implied: auth works)
- Done: 2 (implied: flow complete)

**Score 3 (Needs intent):**
> "Make the app faster"

- Outcome: 0 (vague)
- Scope: 0 (entire app)
- Constraints: 0 (none)
- Success: 1 (faster, but how much?)
- Done: 0 (when?)
