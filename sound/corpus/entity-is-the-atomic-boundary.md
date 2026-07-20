---
paths: "**/*.{ts,tsx}"
when: distributed
source: Helland
topic: consistency
---
when: [distributed] · tier: high-stakes · check: judgeable
A single write is atomic only within one entity (one aggregate, one unique id, one machine); never span two services or two aggregates in one transaction, distributed lock, or 2PC — cross-entity effects go out as an idempotent message and reconcile by compensation.
WRONG:
```ts
await tx(async (db) => {
  await db.orders.update(orderId, { status: 'paid' })
  await db.inventory.decrement(sku, qty)   // different entity, same tx
})
```
RIGHT:
```ts
await Orders.apply(orderId, { status: 'paid' })      // one entity, atomic
await Outbox.enqueue({ type: 'RESERVE_STOCK', sku, qty, key: orderId })
// inventory service consumes, reserves, emits StockReserved | StockRejected
```
_Avoid_: a `tx`/`transaction`/`withTransaction` body that touches two service clients or two aggregate repositories; `acquireLock`/`distributedLock` spanning services; `twoPhase`/`2pc`/`prepareCommit`.
Detect: a single transaction or lock scope whose body mutates more than one aggregate root or calls more than one service's data client; a "keep both sides in sync" comment over paired writes.
Not-when: both writes target the same aggregate/entity, or it's a single-node local DB transaction over one bounded context.
