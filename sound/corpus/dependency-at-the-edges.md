---
paths: "**/*.{ts,tsx}"
when: always
source: house
topic: effects
---
when: [always] · tier: standard · check: deterministic
Every source of impurity — nondeterminism (clock, random, id, network), storage, config, env, stateful singletons — has exactly ONE owning module behind a typed surface, wired once at the composition root. Call sites NEVER inline `new Date()`, `Date.now()`, `Math.random()`, `localStorage`, or `process.env`; no ambient globals. A pure function that needs the current time takes it as a parameter.
WRONG:
```ts
function makeOrder(items: Item[]) {
  return { id: Math.random().toString(36), createdAt: new Date(), items };
}
```
RIGHT:
```ts
function makeOrder(items: Item[], deps: { clock: Clock; ids: Ids }) {
  return { id: deps.ids.next(), createdAt: deps.clock.now(), items };
}
```
_Avoid_: `new Date()`, `Date.now()`, `Math.random()`, `crypto.randomUUID()`, `localStorage`, `process.env`, or a mutable singleton read mid-business-logic instead of injected.
Detect: grep call sites (outside the one owning module and the composition root) for `new Date(`, `Date.now(`, `Math.random(`, `localStorage`, `process.env`.
Not-when: the composition root itself, or the single module that owns and wraps the impure capability behind its typed surface.
Cross-ref: replicated-state-is-a-deterministic-fold — in [distributed] replay, an inlined clock is a divergence bug, not just an untestable smell.
