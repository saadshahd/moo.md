---
paths: "**/*.{ts,tsx}"
when: distributed
source: Nygard
---
when: [distributed] · tier: high-stakes · check: judgeable
Wrap every external dependency (a different team's service, a third-party API, anything you don't deploy) in one typed adapter that owns its own timeout, retry policy, circuit breaker, AND the structured observability of the boundary (the attempt/result logs or trace) — call sites depend on the adapter's interface, never the transport client directly.
WRONG:
```ts
// scattered across 6 files
const stripe = new Stripe(key)
await stripe.charges.create(...)
```
RIGHT:
```ts
// Payments.ts — the single owning module
const Payments = { charge, refund } as const
function charge(order: Order) { return breaker.call(() => stripe.charges.create(...)) }
```
_Avoid_: a raw third-party SDK client (`stripe.`, `new S3Client`, `axios.create`) imported and called directly outside one designated adapter module.
Detect: a third-party or cross-service client instantiated and called from more than one module across the codebase.
Not-when: a single call site that will never grow a second caller — sharpen only if a second consumer appears.
Cross-ref: cross-boundary-facts-are-queryable — the boundary observability this adapter owns, so the structured record lives in one place instead of at every call site.
