---
paths: "**/*.{ts,tsx}"
when: distributed
source: Helland
topic: integration
---
when: [distributed] · tier: standard · check: judgeable
Data received from another service is a versioned snapshot from the past — store it immutably with the version/timestamp it arrived under, and treat a decision made on it as possibly-stale; never mutate a foreign record in place or read it back as if it were live truth.
WRONG:
```ts
const user = await usersApi.get(id)   // remote, mutable-looking
user.tier = 'gold'                    // mutating someone else's truth
await act(user)                       // and it may already be stale
```
RIGHT:
```ts
type ForeignUser = { id: string; tier: Tier; asOf: string; version: number }
const snapshot: ForeignUser = await usersApi.get(id)   // a past fact, frozen
const decision = decideOn(snapshot)                    // carries snapshot.asOf
await act({ decision, basedOn: snapshot.version })      // staleness is visible downstream
```
_Avoid_: storing a foreign record without an `asOf`/`version`/`observedAt`; re-reading a cached foreign value as authoritative for a write decision.
Detect: assignment into a property of a remote-fetched object; a persisted copy of external data with no version/as-of column; a write-side invariant enforced against a value sourced across a boundary.
Not-when: the data is owned inside this service's own transaction boundary (data on the inside — mutable and "now").
