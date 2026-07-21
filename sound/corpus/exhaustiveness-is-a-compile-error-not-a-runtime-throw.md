---
paths: "**/*.{ts,tsx}"
when: always
source: Vergnaud
topic: types
---
when: [always] · tier: standard · check: deterministic
Every function that branches over a union's tag must be checked exhaustive by the type system — either a `Record<Tag, Handler>` (a missing key fails to compile) or a `default: assertNever(x)` arm typed to take `never` — never a `switch` with no default, and never a runtime `throw new Error('unhandled case')` as the only guard.
_Avoid_: a `switch` over a discriminated union with no `default`; a `default` branch whose body is reachable code rather than a `never`-typed assertion.
Detect: a switch/if-chain over a `.kind`/`.type`/`.status` tag with no exhaustiveness enforcement — check whether removing a case still compiles clean.
Not-when: the union is genuinely open-ended at the type level (e.g. branching on a plain `string`, not a closed union) — there's nothing to exhaust. And the `throw` inside an `assertNever`-shaped helper is not a violation of the no-throw regime: its parameter is typed `never`, so it fires only as a compile error at the call site when a new union member is added, not a runtime failure path.
