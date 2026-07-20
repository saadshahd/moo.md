---
paths: "**/*.{ts,tsx}"
when: always
source: Feathers
topic: abstraction
---
when: [always] · tier: standard · check: judgeable
A seam introduced to make code testable is an internal implementation detail with one call-site contract, not a second public interface living alongside the first — don't let "add a seam" become "add a v2 API and deprecate the v1 one."
WRONG:
```ts
// old
export function chargeCard(card: Card, amount: number) { /* ... */ }
// "seam" added as a parallel v2 the codebase migrates to gradually
export function chargeCardV2(card: Card, amount: number, gateway: Gateway) { /* ... */ }
```
RIGHT:
```ts
// The seam is the injected dependency, not a new function name.
// Same call sites, same signature shape, changed everywhere at once.
export function chargeCard(card: Card, amount: number, gateway: Gateway = ProdGateway) { /* ... */ }
```
_Avoid_: `*V2`, `*New`, `*Next` function/class names; two call-site conventions for what is conceptually one operation
Detect: two functions/exports with near-identical names and overlapping purpose where one is described as "new" or "replacement" and both remain callable
Not-when: never — a seam that requires a parallel interface to exist isn't a seam, it's an unfinished migration (atomicity-three-regimes governs the transition mechanic when one is genuinely needed).
