---
when: distributed
source: Kleppmann
topic: consistency
---
A cache, search index, or denormalized table is a projection of an authoritative source, not a second source of truth — every write flows to the source first, and the projection MUST be droppable and rebuildable from it.
_Avoid_: no rebuild path from source
Detect: a write path whose sole durable target is a derived store, or business logic reading a cache/index as ground truth with no authoritative source behind it
Not-when: the store IS the system of record (no upstream source it projects from)
