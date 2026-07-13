---
paths: "**/*.{test,spec}.{ts,tsx}"
when: always
source: Hughes
---
when: [always] · tier: standard · check: judgeable
Three or more test cases in one `describe` block that differ only in the literal input/output values, not in the assertion shape, are one un-stated universal property wearing example-test clothing — extract the property and delete the examples it subsumes.
WRONG:
```ts
test('doubles 2', () => expect(double(2)).toBe(4));
test('doubles 3', () => expect(double(3)).toBe(6));
test('doubles -1', () => expect(double(-1)).toBe(-2));
test('doubles 0', () => expect(double(0)).toBe(0));
```
RIGHT:
```ts
test('double(n) === n + n', () => {
  // property + genInteger: a property runner over a generated domain,
  // whatever property library the project uses
  property(genInteger, (n) => expect(double(n)).toBe(n + n));
});
```
_Avoid_: a run of `test(...)` calls in the same file with structurally identical bodies and only the numeric/string literals varying.
Detect: within one `describe`, count assertion bodies with identical AST shape modulo literals — 3+ is the threshold; the property that generalizes them is missing from the file.
Not-when: each case exercises a genuinely distinct code path (a different branch, a different error type) rather than the same computation at a different value — that's boundary/branch coverage, not a hidden property, and stays example-based.
Cross-ref: one-behavior-per-test — cases differing in code PATH (branch taken / error type) stay as named one-behavior examples; cases differing only in LITERALS collapse to one extracted property.
