---
paths: "**/*.{test,spec}.{ts,tsx}"
when: always
source: Hughes
topic: tests
---
when: [always] · tier: standard · check: judgeable
A named generator (`genValidOrder`, `genExpiredToken`) is the executable definition of a domain concept — write it once, colocate it with the domain type it generates, and reuse it across every property that needs "a valid order"; never inline an ad-hoc record generator per test that silently redefines what "valid" means.
WRONG:
```ts
// in payment.test.ts
property(genRecord({ amount: genNat, currency: oneOf('USD', 'EUR') }), check)
// in refund.test.ts — same shape, redefined, now drifting
property(genRecord({ amount: genIntFrom(0), currency: genString }), check)
```
RIGHT:
```ts
// payment/generators.ts — a named generator colocated with the type it generates
// Generator/genRecord are whatever property library the project uses
export const genValidPayment: Generator<Payment> =
  genRecord({ amount: genNat, currency: oneOf('USD', 'EUR') });
// reused unmodified in payment.test.ts AND refund.test.ts
```
_Avoid_: two or more inline record-generator literals across test files describing the same domain type with different field constraints.
Detect: grep test files for inline record/tuple generator construction of the same domain type in more than one file — that's the domain constraint drifting, not colocated.
Not-when: the generator is genuinely local and single-use (a one-off malformed-input case for a single negative test) — promoting every generator to a shared module is its own overhead; only extract once a second consumer needs the same domain shape.
