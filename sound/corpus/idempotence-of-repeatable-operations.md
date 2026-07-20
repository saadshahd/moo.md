---
paths: "**/*.{test,spec}.{ts,tsx}"
when: always
source: Hughes
topic: tests
---
when: [always] · tier: standard · check: deterministic
Any operation documented or named as safe-to-repeat (normalize, sort, dedupe, sanitize, upsert) must satisfy `f(f(x)) === f(x)` for generated `x`.
WRONG:
```ts
test('normalizes whitespace', () => {
  expect(normalize('  a  b ')).toBe('a b');
});
```
RIGHT:
```ts
test('normalize is idempotent', () => {
  // property + genString: a property runner over a generated domain,
  // whatever property library the project uses
  property(genString, (s) =>
    expect(normalize(normalize(s))).toBe(normalize(s))
  );
});
```
_Avoid_: a function name containing "normalize"/"sanitize"/"dedupe" with only single-application example tests in its suite.
Detect: grep the function's test file for `f(f(` or an idempotence-named test; absence when the function name promises repeatability is the smell.
Not-when: the operation is explicitly one-shot or stateful across calls (an ID generator, a counter increment) — idempotence isn't the claim being made, don't manufacture a law nobody asserted.
