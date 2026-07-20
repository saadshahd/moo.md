---
paths: "**/*.{ts,tsx}"
when: distributed
source: Lamport
topic: resilience
---
when: [distributed] · tier: high-stakes · check: judgeable
A call that crosses a process boundary resolves to `ok | failed | unknown` — never a two-way `ok | failed`. A timeout means the request may have been applied; the caller must be able to branch on "don't know."
WRONG:
```ts
async function charge(id: string): Promise<Result<Receipt, PaymentDeclined>>
// timeout has nowhere to go — it throws, or gets miscoded as "declined" and retried into a double charge
```
RIGHT:
```ts
type Outcome<T, E> =
  | { status: 'ok'; value: T }
  | { status: 'failed'; error: E }        // definitely did not happen
  | { status: 'unknown'; ref: string }    // may or may not have happened — reconcile by ref
async function charge(id: string): Promise<Outcome<Receipt, PaymentDeclined>>
```
_Avoid_: a `Result<T, E>` two-arm union as the return type of a network/RPC/queue call; treating a timeout as a `failed` arm.
Detect: a function that awaits a network/RPC/DB-over-network call and whose return type has no arm distinct from clean failure for "timed out / no response." At a remote boundary, "unknown" is a surfacing failure the caller genuinely must branch on — it cannot be defined out of existence or masked at a lower layer.
Not-when: in-process calls, or genuinely idempotent reads where re-issuing is free (then a retry loop masks it at the lowest layer — decision-order step 2).
Cross-ref: eliminate-mask-then-surface — the error-handling order this specializes for `[distributed]`, where "unknown" is the one arm that must reach the caller.
