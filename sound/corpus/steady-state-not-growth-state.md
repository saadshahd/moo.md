---
paths: "**/*.{ts,tsx}"
when: db, distributed
source: Nygard
topic: resilience
---
Any collection that can grow without bound (logs, caches, in-memory queues, retry buffers) must have an explicit eviction, cap, or TTL.
_Avoid_: module-scope arrays/maps/sets that only grow (`.push`, `.set`, `.add`) with no corresponding bound, TTL, or LRU eviction anywhere in the same module.
Detect: an in-memory collection with writes but no size cap, expiry, or eviction path reachable from the same module.
Not-when: bounded-by-construction collections (one entry per request, cleared at request end) or genuinely small enumerable sets (config keys, feature flags).
