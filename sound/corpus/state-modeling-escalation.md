---
paths: "**/*.{ts,tsx}"
when: always
source: house
topic: types
---
when: [always] · tier: standard · check: judgeable
A plain discriminated union of states is the resting state and usually the end of it. Escalate to an explicit `state -> event -> nextState` transition map ONLY when a guarded or asymmetric single-axis transition is referenced from many call sites — and even then an illegal transition is a no-op, NOT a throw. Reach for orthogonal-region machinery ONLY when there are 2+ genuinely independent concurrent axes with illegal combinations. Absent the named trigger, the union stands.
WRONG:
```ts
// one call site, one transition — a full machine is ceremony
const machine = createMachine({ states: { idle: { on: { GO: 'busy' } }, busy: {} } });
```
RIGHT:
```ts
// transition guarded and referenced from many call sites → map; illegal = no-op
const next: Record<State, Partial<Record<Event, State>>> = {
  idle: { START: 'running' },
  running: { PAUSE: 'paused', STOP: 'idle' },
  paused: { RESUME: 'running', STOP: 'idle' },
};
const advance = (s: State, e: Event): State => next[s][e] ?? s;
```
_Avoid_: a state machine or actor for a choice a discriminated union already models; a transition map that throws on an unknown edge instead of returning the current state.
Detect: machinery (`createMachine`, hand-rolled reducer with an events enum) wrapping a single-site transition; or an illegal-transition branch that throws.
Not-when: the trigger is present — a guarded transition genuinely fanned across many call sites (map), or independent concurrent axes with illegal combinations (regions).
Cross-ref: discriminated-union-over-flag-bag — the resting state this escalates from.
