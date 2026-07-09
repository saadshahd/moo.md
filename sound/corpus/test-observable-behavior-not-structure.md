---
paths: "**/*.{test,spec}.{ts,tsx}"
when: always
source: Beck
---
when: [always] · tier: standard · check: judgeable
A test asserts what the code does for a caller, never how it does it internally — if renaming a private helper breaks the test, the test is wrong, not the rename.
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
_Avoid_: `jest.spyOn` on your own module, `toHaveBeenCalledWith` against internal collaborators, snapshot tests of intermediate objects, testing private/unexported functions directly.
Detect: a test importing something not exported from the module's public surface, or asserting call counts/arguments on a function defined in the same package under test.
Not-when: the collaborator being spied on crosses a real architectural boundary you don't own (a paid API, a queue) — that's an integration test's job, not a unit test's.
