---
paths: "**/*.{ts,tsx}"
when: distributed
source: house
topic: integration
---
when: [distributed] · tier: standard · check: judgeable
When state spans processes, services, or third parties, make it observable at runtime — tracing, or structured logs — emitted INSIDE the one adapter that owns the boundary (integration-point-isolation), so it can be re-derived on demand. Never depend on holding distributed state in your head, or in a static note that goes stale the moment the system moves.
WRONG:
```ts
// "the payment service is always up by the time we call it" — a fact held in your head,
// unobservable when it turns out false at 3am
await payments.capture(orderId);
```
RIGHT:
```ts
// inside the Payments adapter — the single owner of this boundary:
function capture(orderId: string) {
  log.info('payment.capture.attempt', { orderId, provider, correlationId });
  const res = await breaker.call(() => stripe.charges.create(/* ... */));
  log.info('payment.capture.result', { orderId, provider, correlationId, status: res.status });
  return res;
}
// call sites just `await Payments.capture(orderId)` — the record is guaranteed, not per-caller discipline
```
_Avoid_: reasoning about a cross-service outcome from memory or a comment; a boundary crossing with no trace/log carrying a correlation id and the observed result; observability left to each call site instead of owned by the boundary's adapter.
Detect: the boundary crossing leaves no structured record anywhere — the owning adapter included — so nothing lets you re-derive what actually happened at that boundary later; a call site that logs while the adapter doesn't is one forgotten caller away from a hole.
Not-when: repo-local, in-process work where the state never leaves the boundary and is fully reconstructable from the code path.
Cross-ref: integration-point-isolation — the adapter that owns this boundary owns its observability too, so the record lives in one place instead of at every call site.
