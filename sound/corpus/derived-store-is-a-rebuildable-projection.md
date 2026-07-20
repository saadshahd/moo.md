---
paths: "**/*.{ts,tsx}"
when: distributed
source: Kleppmann
topic: consistency
---
when: [distributed] · tier: standard · check: judgeable
A cache, search index, or denormalized table is a projection of an authoritative source, not a second source of truth — every write flows to the source first, and the projection MUST be droppable and rebuildable from it.
WRONG:
```ts
await searchIndex.upsert(doc)                       // index-only write; source never sees it
```
RIGHT:
```ts
const saved = await Orders.put(doc)                 // authoritative source is written first
await Projections.apply(saved)                      // index/cache derived; safe to drop+rebuild
```
_Avoid_: no rebuild path from source
Detect: a write path whose sole durable target is a derived store, or business logic reading a cache/index as ground truth with no authoritative source behind it
Not-when: the store IS the system of record (no upstream source it projects from)
