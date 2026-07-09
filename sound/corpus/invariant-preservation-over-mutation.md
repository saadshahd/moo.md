---
paths: "**/*.{test,spec}.{ts,tsx}"
when: db
source: Hughes
---
when: [db] · tier: high-stakes · check: deterministic
Any function that transforms a collection or aggregate under a stated invariant (sorted order, uniqueness, total balance, non-negative quantity) must be tested by asserting the invariant holds on the *output*, for all generated inputs — not by checking one example transformation.
WRONG:
```ts
test('applies discount', () => {
  const cart = { items: [{ price: 10, qty: 2 }], total: 20 };
  expect(applyDiscount(cart, 0.1).total).toBe(18);
});
```
RIGHT:
```ts
test('total is never negative after any discount', () => {
  // property over two generated domains (a cart and a percentage in [0,1]),
  // whatever property library the project uses
  property(genCart, genPercent, (cart, pct) =>
    expect(applyDiscount(cart, pct).total).toBeGreaterThanOrEqual(0)
  );
});
```
_Avoid_: asserting on one literal output shape (`.toEqual({...})`) where the actual claim is a property of the output (ordering, sign, sum), not its exact value.
Detect: a mutation/transform function in a `[db]`-tagged module whose tests only use `toEqual` against literals — no test asserts a relational or structural property (`>=`, `toBeSorted`, `Set` uniqueness) across generated inputs.
Not-when: the transform's whole contract IS a specific literal mapping (a fixed lookup table, a currency-formatting table) — there's no universally-quantified invariant to state, an example suite over the table's domain is the correct test.
