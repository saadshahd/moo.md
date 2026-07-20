---
paths: "**/*.{ts,tsx}"
when: distributed
source: Nygard
topic: resilience
---
when: [distributed] · tier: high-stakes · check: judgeable
Give each external dependency its own bounded resource pool (connections, concurrency limit, queue) — one saturated dependency must not starve capacity another dependency needs.
WRONG:
```ts
const pool = new Pool({ max: 50 }) // shared by every downstream call
```
RIGHT:
```ts
const criticalPool = new Pool({ max: 30 })
const reportingPool = new Pool({ max: 10 }) // slow analytics can't starve the critical path
```
_Avoid_: one global connection pool, thread pool, or semaphore shared across dependencies with materially different latency/criticality profiles.
Detect: a single shared pool/limiter instance passed to both a request-path-critical dependency and a slow/best-effort one.
Not-when: dependencies with genuinely equivalent criticality and latency — partitioning two identical-risk calls is ceremony, not protection.
