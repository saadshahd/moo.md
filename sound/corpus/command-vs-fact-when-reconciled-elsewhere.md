---
paths: "**/*.{ts,tsx}"
when: always
source: house
---
when: [always] · tier: standard · check: judgeable
Separate intent from fact ONLY when the outcome is reconciled elsewhere — a server, a queue, a peer — so the thing you intended and the thing that's confirmed live in different moments. Then model `request -> pending -> (confirmed | rejected)` as discriminated states. NEVER collapse an unconfirmed intent and a confirmed fact into one mutable field. Locally-authoritative synchronous state has no such gap — it stays a plain value; never add pending machinery to it.
WRONG:
```ts
order.confirmed = true;   // mutated in place over the intended value, before the server agreed
```
RIGHT:
```ts
type Order =
  | { status: 'pending' }
  | { status: 'confirmed'; at: number }
  | { status: 'rejected'; reason: string };
```
_Avoid_: a single mutable boolean/field standing for both "I asked" and "it's confirmed" when confirmation comes from elsewhere; pending/confirmed machinery bolted onto state that's authoritative right here.
Detect: a field written optimistically before a remote acknowledgement, with no distinct state for the in-flight request — the intent and the fact have been fused. Ask whether the truth is decided here or reconciled elsewhere; only the latter earns the three-state split.
Not-when: the state is locally authoritative and synchronous with nothing to reconcile — a plain value is correct.
Cross-ref: mood-names-commands-facts — the naming surface of this split; pure-decide-emits-facts — the handler shape at an aggregate.
