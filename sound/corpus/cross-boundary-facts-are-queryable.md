---
paths: "**/*.{ts,tsx}"
when: distributed
source: house
---
when: [distributed] · tier: standard · check: judgeable
When state spans processes, services, or third parties, make it observable at runtime — tracing, or structured logs at the boundary — so it can be re-derived on demand. Never depend on holding distributed state in your head, or in a static note that goes stale the moment the system moves.
WRONG:
```ts
// "the payment service is always up by the time we call it" — a fact held in your head,
// unobservable when it turns out false at 3am
await payments.capture(orderId);
```
RIGHT:
```ts
log.info('payment.capture.attempt', { orderId, provider, correlationId });
const res = await payments.capture(orderId);
log.info('payment.capture.result', { orderId, provider, correlationId, status: res.status });
```
_Avoid_: reasoning about a cross-service outcome from memory or a comment; a boundary crossing with no trace/log carrying a correlation id and the observed result.
Detect: a call into another process/service/third party whose request and response leave no structured record — nothing lets you re-derive what actually happened at that boundary later.
Not-when: repo-local, in-process work where the state never leaves the boundary and is fully reconstructable from the code path.
