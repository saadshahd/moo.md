---
paths: "**/*.{ts,tsx}"
when: always
source: house
topic: abstraction
---
when: [always] · tier: standard · check: deterministic
A function with 3+ parameters takes a single object parameter. Group related primitives into named domain concepts rather than a positional list the caller must remember the order of.
WRONG:
```ts
function createUser(name: string, email: string, age: number, isAdmin: boolean) {}
createUser('Sam', 'sam@x.io', 30, true); // which boolean was which?
```
RIGHT:
```ts
function createUser(user: { name: string; email: string; age: number; isAdmin: boolean }) {}
createUser({ name: 'Sam', email: 'sam@x.io', age: 30, isAdmin: true });
```
_Avoid_: any function declaration with 3 or more positional parameters; a call site passing a run of bare literals whose meaning depends on position.
Detect: grep function signatures for 3+ comma-separated parameters; each hit is a candidate.
Not-when: the parameters are already one cohesive tuple with a conventional order (e.g. `(x, y, z)` coordinates), or a framework contract fixes the positional signature.
Cross-ref: data-clump-to-parameter-object — the cross-signature version: the same primitives recurring across 2+ signatures name a missing domain concept.
