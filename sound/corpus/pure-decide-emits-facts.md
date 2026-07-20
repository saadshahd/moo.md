---
paths: "**/*.{ts,tsx}"
when: distributed
source: Vernon
topic: messaging
---
when: [distributed] · tier: standard · check: judgeable
A command handler is a pure `decide` function — `(state, command) -> Result<Fact[], E>` — that never persists, logs, or mutates in place. A separate edge function applies the emitted facts and does the IO.
WRONG:
```ts
function placeOrder(order: Order) {
  order.status = 'placed'
  db.save(order)
}
```
RIGHT:
```ts
function decide(state: Order, cmd: PlaceOrder): Result<OrderPlaced[], OrderInvariantViolation> { ... }
// caller: const facts = decide(...); if (facts.ok) { apply(facts.value); db.save(...) }
```
_Avoid_: a command handler that persists, logs, or mutates state in the same body that computes the domain decision.
Detect: a command-handling function whose body both computes the domain change and calls persistence/IO/logging.
Not-when: state is locally authoritative with nothing to reconcile elsewhere and no audit-trail need — then plain in-place mutation behind side-effects-visible-at-the-call-site is enough; don't impose fact-emission machinery without that trigger.
Cross-ref: mood-names-commands-facts, dependency-at-the-edges — the command/fact naming and edge-isolation rules this specializes for aggregates.
