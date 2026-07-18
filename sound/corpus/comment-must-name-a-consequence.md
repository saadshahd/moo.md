---
paths: "**/*.{ts,tsx}"
when: always
source: house
---
when: [always] · tier: standard · check: judgeable
Inline comments are a smell: if a line needs explaining, rename, extract, or restructure until it doesn't. Block comments are acceptable only where the code cannot be made self-describing — a regulatory constraint, a non-obvious performance decision, a workaround for an external bug — and they explain WHY, never WHAT. A `//` comment survives only when omitting it would let a future editor silently break a non-obvious constraint, so it MUST name a consequence or an external-system mapping. A comment that narrates the edit rather than the code — "updated to fix X", "now also handles Y", "changed from Z" — is always wrong: change history belongs in the commit message, not the source.
WRONG:
```ts
// increment the counter
counter += 1;
// loop over users and collect their ids
const ids = users.map(u => u.id);
// updated to also handle refunds (was charges-only)  ← narrates the change, not the code
function process(tx: Tx) { /* ... */ }
```
RIGHT:
```ts
// removing this retry breaks the calibration cache — upstream returns 0 on cold start
const reading = withRetry(fetchReading);
// parse :: string => Result<Order, ParseError>
const parse = pipe(tokenize, buildOrder);
```
_Avoid_: a comment that restates the code beneath it in English; a WHAT-narration of a loop, assignment, or call; step-by-step narration of a function body; a comment narrating the edit's history ("updated", "was", "now", "previously") instead of the code's present behavior.
Detect: read each comment against its line — if the line's identifiers already say what the comment says, delete it. The sole sanctioned inline exception is a Hindley-Milner type signature over an argument-free point-free binding, documenting SHAPE only.
Not-when: the comment encodes a genuine external constraint (regulation, a documented upstream bug, a measured performance tradeoff) that the code cannot express on its own — keep it, and make it name the WHY.
