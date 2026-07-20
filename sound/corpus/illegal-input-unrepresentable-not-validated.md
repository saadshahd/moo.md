---
paths: "**/*.{ts,tsx}"
when: always
source: Bloch
topic: types
---
when: [always] · tier: standard · check: judgeable
Where the type system can make a wrong call impossible to construct, do that instead of accepting a wide type and validating it at runtime — a caller should not be able to compile a call that fails.
WRONG:
```ts
const setDiscount = (percent: number) => { /* runtime: if (percent < 0 || percent > 100) ... */ }
setDiscount(150) // compiles, fails at runtime
```
RIGHT:
```ts
type Percent = { readonly brand: unique symbol } & number
const Percent = { of: (n: number): Result<Percent, 'outOfRange'> =>
  n >= 0 && n <= 100 ? { ok: true, value: n as Percent } : { ok: false, error: 'outOfRange' } }
const setDiscount = (percent: Percent) => { /* percent is already known valid */ }
```
_Avoid_: a runtime `if`-chain re-checking a constraint the type could have enforced at the boundary; accepting `string` where only a closed set of values is legal.
Detect: a runtime guard clause at the top of a function whose only job is rejecting inputs the parameter type allowed through; a validation function whose output is discarded (its boolean is checked, not its narrowed value threaded onward).
Not-when: the constraint depends on data unavailable at compile time (a DB lookup, a cross-field business rule checked against live state) — that stays a runtime `Result`, not a branded type.
