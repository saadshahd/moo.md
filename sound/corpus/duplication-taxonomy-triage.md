---
paths: "**/*.{ts,tsx}"
when: always
source: Fowler
---
when: [always] · tier: standard · check: judgeable
A single duplicated concept (not just duplicated text) is a defect — the cost of extraction is always less than the cost of divergence. Before extracting, name which of the four duplication tiers you're looking at — function, logic, concept, pattern.
WRONG:
```ts
// billing-service.ts
if (user.status === 'active' && !user.deletedAt) chargeSubscription(user);
// analytics-service.ts — same concept, silently missing emailVerified
if (user.status === 'active' && !user.deletedAt) trackActiveUser(user);
```
RIGHT:
```ts
const isActiveUser = (u: User) =>
  u.status === 'active' && !u.deletedAt && u.emailVerified;

if (isActiveUser(user)) chargeSubscription(user);
if (isActiveUser(user)) trackActiveUser(user);
```
_Avoid_: re-deriving the same predicate with slightly different clauses per call site; a threshold or business rule expressed as a literal in more than one file.
Detect: two or more `if`/ternary chains that reference the same 2+ domain fields together, even with different variable names or added/dropped clauses — a copy-paste detector won't flag this because the text differs; you have to read for the decision, not the syntax.
Not-when: the resemblance is coincidental — two unrelated domain rules that happen to share a shape today but have no reason to change together tomorrow.
Cross-ref: complecting-shared-construct-split-by-reason-to-change — the inverse move: splitting one over-merged construct rather than extracting a duplicated concept.
