---
when: distributed
source: Armstrong
topic: resilience
---
One job or request failing must never take down or corrupt the processing of any other concurrently in-flight job or request — isolate at the unit-of-work boundary, not by wrapping deeper business logic in defensive checks.
_Avoid_: a synchronous `for`/`for...of` loop over a batch where a single unhandled throw stops iteration for all remaining items.
Detect: a shared loop or shared execution context processing multiple independent units of work with no per-unit isolation (`allSettled`, per-job try-scope, or per-job process/worker).
Not-when: the batch is a single logical transaction where partial completion is itself the failure mode (e.g., a multi-row DB write that must be atomic) — that's a transactional-boundary concern, not a fault-isolation one.
