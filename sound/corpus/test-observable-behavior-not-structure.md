---
paths: "**/*.{test,spec}.{ts,tsx}"
when: always
source: Beck
topic: tests
---
when: [always] · tier: standard · check: judgeable
A test asserts what the code does for a caller, never how it does it internally — if renaming a private helper breaks the test, the test is wrong, not the rename. Doubles belong only at a seam you own (your integration-point adapter over a paid API, a queue, the clock), never over your own internals or a third party's; and a test whose every assertion is derived from its own stubs verifies nothing — it asserts the mock, not the code.
WRONG:
```ts
it('calls formatCurrency then roundToCents', () => {
  const spy = jest.spyOn(mod, 'formatCurrency')
  computeTotal(cart)
  expect(spy).toHaveBeenCalled()
})
```
RIGHT:
```ts
it('rounds a $10.005 cart to $10.01', () => {
  expect(computeTotal(cart)).toBe(1001)
})
```
_Avoid_: `jest.spyOn` on your own module, `toHaveBeenCalledWith` against internal collaborators, snapshot tests of intermediate objects, testing private/unexported functions directly; a mock whose configured return value is the same value the test then asserts (a tautological mock); doubling a third-party library's internals instead of your own adapter over it.
Detect: a test importing something not exported from the module's public surface, or asserting call counts/arguments on a function defined in the same package under test; a test whose asserted output is fully determined by a stub's configured return, so nothing of the code under test is actually exercised.
Not-when: the double stands at a seam you own — your typed adapter over a paid API, a queue, the clock (integration-point-isolation gives you that seam) — that's the sanctioned place for a fake; the ban is on doubling your own internals, or a third party's internals directly instead of your adapter over it.
