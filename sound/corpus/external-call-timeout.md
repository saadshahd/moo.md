---
paths: "**/*.{ts,tsx}"
when: distributed
source: Nygard
topic: resilience
---
when: [distributed] · tier: high-stakes · check: deterministic
Every call across a process boundary (HTTP, DB, queue, cache, RPC) carries an explicit timeout at the call site — never the transport default, never absent.
_Avoid_: bare `fetch(`, `.query(`, `.send(`, `axios.get(` with no timeout/signal argument; client constructed once at module scope with no per-call or client-level timeout config.
Detect: an outbound network or DB call whose call site (or its client construction) carries no timeout/deadline parameter.
Not-when: same-process function calls; in-memory operations; a call already wrapped by a library-level default timeout that is itself explicit and short (verify the default, don't assume it).
