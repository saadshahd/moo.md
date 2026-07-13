---
paths: "**/*.{ts,tsx}"
when: distributed
source: Lamport
---
when: [distributed] · tier: high-stakes · check: deterministic
State that is rebuilt on more than one node from the same ordered inputs is a pure `fold(events)` — the reducer takes no clock, no random, no ambient read, so identical logs yield identical state on every replica.
WRONG:
```ts
const apply = (s: State, e: Event): State =>
  ({ ...s, log: [...s.log, { ...e, at: Date.now(), id: Math.random() }] })  // replicas diverge
```
RIGHT:
```ts
const apply = (s: State, e: Event): State =>        // apply :: (State, Event) => State
  ({ ...s, log: [...s.log, e] })                    // e already carries its own id + time, assigned at the edge
const rebuild = (events: readonly Event[]) => events.reduce(apply, empty)
```
_Avoid_: `Date.now()`, `new Date()`, `Math.random()`, `crypto.randomUUID()`, `process.env`, or any I/O inside a function that is replayed/replicated to reconstruct state.
Detect: a reducer/fold used to rebuild replicated or event-sourced state that reads a nondeterministic or ambient source; nondeterminism must be captured into the event at the edge, not re-drawn on replay. For `[distributed]` state, an inlined `Date.now()` is not merely an untestable smell — it is a divergence bug across replicas.
Not-when: single-node derivation where the fold is never replayed on another machine.
Cross-ref: dependency-at-the-edges — the impurity-isolation rule this sharpens for `[distributed]`.
