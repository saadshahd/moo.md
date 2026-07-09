---
paths: "**/*.{ts,tsx}"
when: always
source: Evans + Vernon
---
when: [always] · tier: high-stakes · check: deterministic
A primitive that carries a domain validation rule / invariant (money, email, quantity, percentage) is a named value object / branded type built by exactly one validated factory — never a bare `string`/`number` threaded through domain signatures on trust.
WRONG:
```ts
function applyDiscount(priceCents: number, pct: number): number {
  return priceCents - priceCents * pct; // nothing stops pct = 150 or priceCents = -5
}
```
RIGHT:
```ts
type Money = { readonly cents: number; readonly currency: CurrencyCode }
const Money = { of: (cents: number, currency: string): Result<Money, InvalidMoney> => ... }
function applyDiscount(price: Money, discount: Percentage): Money { /* both already valid */ }
```
_Avoid_: exported domain-layer function signatures where a domain-meaningful `number`/`string` param is unwrapped — `amount: number`, `email: string`, `rate: number`, `quantity`, `percent` — in domain (not I/O-boundary) code.
Detect: scan exported domain-layer function signatures for bare `number`/`string` params whose name matches a known domain-quantity vocabulary (amount, price, percent, email, quantity, rate); a value object with a smart constructor should sit between the primitive and the domain function.
Not-when: the primitive is purely structural (an opaque `id: string` with no validation rule beyond "is a string") — that's a branded type, not a full value object; pure infrastructure / serialization edges (DB row shape, JSON wire body) where the primitive is the legitimately-unparsed wire format.
Cross-ref: illegal-input-unrepresentable-not-validated — the general principle this instantiates for domain primitives; branded-primitives-for-domain-ids — the no-invariant case: a brand gives identity without validation, a value object adds the validated factory.
