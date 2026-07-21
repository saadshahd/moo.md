---
paths: "**/*.{ts,tsx}"
when: always
source: house
topic: types
---
when: [always] · tier: standard · check: judgeable
Absence must be asked as ONE named terse question, never mechanical enumeration. (1) Absence you author: optional property / `?.` / `??` — never explicit null/undefined unions. (2) Absence you don't own (refs, foreign payloads, stdlib): take the foreign type as-is and absorb it at the boundary — parse into your shape once — OR check it with one named terse predicate; inline `=== null ||` chains are the defect. (3) Truthiness is the default check, deliberately coarse when the domain is coarse; escalate precision (isNil-shape, explicit compare) only when `0` / `false` / `''` are live domain values, and prefer named collection predicates (isEmpty-shape) over mechanical comparisons like `a.length === 0`. (4) No Option/Maybe wrapper in TS — native `?.` / `??` / `field?:` IS the Option sugar; a wrapper reintroduces the noise the rule kills. Division of labor: `Result` when failure carries a reason the caller branches on; native optionality when absence is just absence.
_Avoid_: inline null/undefined equality chains; length-comparison where a named emptiness predicate exists; Option-wrapper types in TS.
Detect: grep for `=== null ||` / `=== undefined` chains and `.length === 0` at call sites; flag any `Option<` / `Maybe<` type declared in TS; the judgment is whether `0`/`false`/`''` are live domain values at that check site.
Not-when: `0` / `false` / `''` are live domain values — then escalate to an explicit compare; a failure that carries a reason — then it's a `Result`, not absence; [react] an API that treats `undefined` as "omit this" (an inline-style value like `gridColumn: on ? v : undefined`, a pass-through optional prop) — an explicit `: undefined` is the idiomatic omission there.
Cross-ref: parse-dont-validate-at-every-untyped-boundary — absorbing a foreign nullable type into your shape once at the boundary. The predicates exist ONCE in the codebase; whether their source is a library or local is a context judgment.
