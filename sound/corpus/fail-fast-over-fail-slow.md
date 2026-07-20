---
paths: "**/*.{ts,tsx}"
when: distributed
source: Nygard
topic: resilience
---
when: [distributed] · tier: standard · check: judgeable
If a dependency is degraded such that success is unlikely, reject immediately — don't queue the caller behind a doomed retry-with-backoff that ties up capacity.
WRONG:
```ts
async function charge(order: Order) {
  for (let i = 0; i < 5; i++) {
    const r = await gateway.charge(order)
    if (r.ok) return r
    await sleep(2000 * i)
  }
}
```
RIGHT:
```ts
async function charge(order: Order): Promise<Result<Receipt, ChargeError>> {
  if (breaker.isOpen('gateway')) return { ok: false, error: { type: 'DEPENDENCY_DOWN' } }
  return gateway.charge(order, { timeoutMs: 1000 })
}
```
_Avoid_: unbounded or long-backoff retry loops wrapping a single external call with no breaker/budget check first; retry count or delay that scales past ~1s total caller-blocking time.
Detect: a loop that retries a single external call with increasing sleeps and no upper bound on total elapsed time before returning to the caller.
Not-when: idempotent background jobs off the request path where slow-eventual-success is the actual contract (a queue consumer, a batch reconciler).
Cross-ref: restart-policy-as-data.md — same WRONG (hand-rolled retry loop), opposite regime: on the request path, breaker-reject fast (this rule); for supervised background work, retry belongs in declarative supervisor config (restart-policy-as-data).
