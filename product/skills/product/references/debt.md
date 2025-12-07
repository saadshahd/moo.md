# Tech Debt Prioritization

Triage technical debt and create prioritized remediation plan.

## Input Required

Ask for:
- Tech debt inventory (GitHub issues, architecture concerns, perf bottlenecks, security findings)
- Team size and sprint capacity (story points/sprint)
- Upcoming major features (next 2-3 quarters)
- System criticality (customer-facing/internal/infrastructure)

## Prioritization Formula

```
Priority = (Business Impact × Urgency) / Engineering Cost
```

Score each factor 1-5.

## Priority Tiers

### Priority 1: Critical Path Blockers

Issues that will prevent upcoming features or pose immediate risk.

For each (2-3 items max):

```
### [Debt Item]

**Business Impact:** [Quantified - what breaks/slows if not fixed]
**Engineering Cost:** [Story points]
**Dependencies:** [What this blocks or what blocks this]
**Sprint:** [Which sprint to schedule]
**Risk if Delayed:** [Specific consequence]

Priority Score: [X.X]
```

### Priority 2: Architectural Improvements

Issues that increase future development velocity (3-5 items).

Same format as P1.

### Priority 3: Quality of Life

Issues that reduce toil but don't block features (3-5 items).

Same format as P1.

### Defer for Now

Explicit list with justification:

| Item | Reason to Defer |
|------|-----------------|
| [Debt] | [Why not this quarter] |

## Constraints

Apply these rules:
- Total capacity <=30% of quarterly sprint points
- At least 1 P1 item by mid-quarter
- No P2 before all P1 complete
- Items >2 sprints must be phased

## Roadmap Integration

For each P1 item:
- Which sprint to schedule
- Which feature it must complete before
- Dedicated sprint or integrated with feature work

## Executive Summary

Provide 3-sentence summary for stakeholders:

1. Total engineering cost for quarter: [X story points]
2. Biggest risk being mitigated: [Risk]
3. Expected velocity improvement: [X%] or [Specific benefit]

## Output Format

```
## Technical Debt Remediation Plan

### Capacity Allocation
- Quarterly capacity: [X] story points
- Debt allocation (30%): [X] story points
- Planned usage: [X] story points

### Priority 1: Critical Path
[Items with full details]

### Priority 2: Architectural
[Items with full details]

### Priority 3: Quality of Life
[Items with full details]

### Deferred
[Table of deferred items]

### Sprint Schedule
| Sprint | Debt Items | Points | Feature Context |
|--------|------------|--------|-----------------|

### Executive Summary
[3 sentences]

### Assumptions to Validate
- [ ] [Missing data point]
- [ ] [Assumption to confirm]
```

## Rules

- Use story points, never time estimates
- Ground recommendations in evidence
- No P2 before all P1 complete
- Phase items >2 sprints
- Use ask tool for missing context
