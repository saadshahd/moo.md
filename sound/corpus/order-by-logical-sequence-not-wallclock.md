---
paths: "**/*.{ts,tsx}"
when: distributed
source: Lamport + Kleppmann
topic: messaging
---
when: [distributed] · tier: high-stakes · check: judgeable
Ordering, causality, and "which write wins" across nodes are decided by a logical sequence (per-source counter / version / vector clock), never by comparing wall-clock timestamps — clocks on different machines skew, jump, and run backwards.
_Avoid_: `Date.now()`, `updatedAt`, `createdAt`, `new Date()`, `timestamp` used inside a comparison / `sort` / `Math.max` that resolves ordering or conflict; `Date.now()` as a version; "last write wins" across nodes.
Detect: a timestamp field feeding a comparison, `sort`, `Math.max`, or LWW/conflict resolution across records that originate on more than one machine. The `_Avoid_` tokens are a deterministic first-pass filter; whether the data is genuinely cross-node is the judgment call.
Not-when: single-process ordering; a timestamp used purely for human display / audit / TTL-expiry; all writes serialized through one authoritative writer (single-leader) whose own sequence orders them.
