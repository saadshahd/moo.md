---
paths: "**/*.{ts,tsx}"
when: distributed
source: Armstrong
---
when: [distributed] · tier: standard · check: judgeable
Retry/backoff/dead-letter behavior for a queue job is declared as data consumed by the queue's own supervisor, never as a hand-rolled retry loop with an internal try/catch. The job body lets an unenumerated failure escape to the supervisor — that escape is legal precisely because it is the unit-boundary crash of error-handling-two-regimes, ending in the queue's redelivery / dead-letter, not a catch that continues.
WRONG:
```ts
async function handle(job: Job) {
  for (let i = 0; i < 3; i++) {
    try { return await doWork(job); } catch { await sleep(1000 * i); }
  }
}
```
RIGHT:
```ts
const jobOptions = { attempts: 3, backoff: { type: 'exponential', delay: 1000 } } as const
queue.add('processOrder', payload, jobOptions)
// doWork lets an unenumerated failure escape; the queue's supervisor owns the retry
```
_Avoid_: `for`/`while` retry loops with `try/catch` and manual `sleep` inside business-logic functions.
Detect: a retry counter and a sleep/backoff computation living inside a handler function's own body, rather than in the queue's job configuration.
Not-when: no external queue/supervisor exists — for a pure synchronous call with no reconciliation elsewhere, this is over-engineering (see Command-vs-fact: no async divergence, no trigger).
Cross-ref: fail-fast-over-fail-slow.md — same WRONG (hand-rolled retry loop), opposite regime: for supervised background work, retry as declarative supervisor config (this rule); on the request path, breaker-reject fast (fail-fast-over-fail-slow).
