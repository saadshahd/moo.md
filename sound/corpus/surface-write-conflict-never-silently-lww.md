---
paths: "**/*.{ts,tsx}"
when: distributed
source: Kleppmann
topic: consistency
---
when: [distributed] · tier: high-stakes · check: judgeable
Concurrent writes to the same key with last-write-wins silently discard a user's data — detect concurrency with a version/etag and either reject the stale write as a typed error or merge; a dropped write is a data-loss bug, so fail loud.
WRONG:
```ts
await Doc.put(id, next)                             // clobbers whatever changed since read
```
RIGHT:
```ts
type SaveError = { type: 'stale'; current: Doc }
async function save(d: Doc): Promise<Result<Doc, SaveError>> {
  return Doc.putIfVersion(d.id, d, d.baseVersion)   // rejects if version moved under us
}
```
_Avoid_: unconditional `put`/`update` on shared keys, resolving overwrites by clock, swallowing the losing write
Detect: a write to a shared key that does not carry the version it read from — no compare-and-set, no conflict branch, so a concurrent update is lost with no signal
Not-when: the key has a single writer, or the datatype is a CRDT whose merge is provably conflict-free
