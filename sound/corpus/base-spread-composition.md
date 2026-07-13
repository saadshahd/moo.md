---
paths: "**/*.{ts,tsx}"
when: always
source: house
---
when: [always] · tier: standard · check: judgeable
When 2+ shaped values share a non-trivial core, define the core ONCE and build each variant by spreading it and adding only its delta; type the result as `Base & Delta`. Never copy the shared fields across variant literals.
WRONG:
```ts
const a = { id, createdAt, ownerId, region, kind: 'a', extra };
const b = { id, createdAt, ownerId, region, kind: 'b', other };
const c = { id, createdAt, ownerId, region, kind: 'c', more };
```
RIGHT:
```ts
const base = { id, createdAt, ownerId, region };
const a = { ...base, kind: 'a', extra };
const b = { ...base, kind: 'b', other };
const c = { ...base, kind: 'c', more };
```
_Avoid_: three or more object literals each restating the same run of base fields; a variant type declared by re-listing shared members instead of intersecting a base.
Detect: 2+ object literals (or type declarations) in the same module that repeat an identical sequence of field names before their differing tail.
Not-when: the shared fields are coincidental — same names, unrelated meaning — where extracting a base would assert a relationship that doesn't exist.
