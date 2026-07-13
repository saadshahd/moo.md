---
paths: "**/*.{ts,tsx}"
when: db, distributed
source: Nygard
---
when: [db, distributed] · tier: high-stakes · check: judgeable
Any collection that can grow without bound (logs, caches, in-memory queues, retry buffers) must have an explicit eviction, cap, or TTL.
WRONG:
```ts
const failedJobs: Job[] = [] // pushed to forever, never trimmed
function retryLater(job: Job) { failedJobs.push(job) }
```
RIGHT:
```ts
const failedJobs = new BoundedQueue<Job>({ max: 1000, onEvict: alertAndDrop })
```
_Avoid_: module-scope arrays/maps/sets that only grow (`.push`, `.set`, `.add`) with no corresponding bound, TTL, or LRU eviction anywhere in the same module.
Detect: an in-memory collection with writes but no size cap, expiry, or eviction path reachable from the same module.
Not-when: bounded-by-construction collections (one entry per request, cleared at request end) or genuinely small enumerable sets (config keys, feature flags).
