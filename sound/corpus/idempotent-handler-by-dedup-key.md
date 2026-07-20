---
paths: "**/*.{ts,tsx}"
when: distributed
source: Lamport + Kleppmann + Helland
topic: messaging
---
when: [distributed] · tier: high-stakes · check: judgeable
Exactly-once delivery is a myth — the network gives at-least-once, so any effectful handler reachable across a process boundary (message, event, webhook, retriable RPC) MUST be idempotent, keyed by a caller-supplied id, so a redelivery is a no-op that returns the first outcome. The dedup key is persisted in the SAME atomic write as the effect, never held in memory and never as a separate read-then-write.
WRONG:
```ts
// retried delivery charges twice
async function handle(msg: ChargeRequest): Promise<Result<Receipt, ChargeFailed>> {
  const receipt = await gateway.charge(msg.amount)  // fires again on redelivery
  return { ok: true, value: receipt }
}
```
RIGHT:
```ts
async function onPaymentCaptured(m: PaymentCaptured) {
  await Ledger.appendOnce({ key: m.messageId, account: m.account, amount: m.amount })
  // appendOnce: insert (key, effect) in ONE write; duplicate key → no-op, returns prior result
}
```
_Avoid_: "exactly-once"; a message/event/webhook/queue handler whose effect is a bare `+=`/`push`/`INSERT`/`append`/`increment`/`send`/`charge` with no dedup key; `at-least-once` treated as `once`; a `messageId` received but never persisted alongside the effect; a dedup check done as a separate read-then-write instead of one atomic upsert.
Detect: an effectful operation triggered by a message/queue/webhook/retriable RPC with no idempotency/dedup key gating the effect (same input applied twice → two effects); a handler named for a fact (`on*`, `handle*Event`) that writes or emits without reading or storing a uniqueness key; a dedup key checked in a separate read before the write rather than in one atomic upsert.
Not-when: the effect is naturally idempotent already (a set-to-value overwrite, an upsert keyed by the entity's own domain id); a pure read; a locally-authoritative synchronous operation with no delivery layer that can redeliver; delivery is exactly-once-guaranteed by the local transport within one process.
