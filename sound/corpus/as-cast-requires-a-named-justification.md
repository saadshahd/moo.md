---
paths: "**/*.{ts,tsx}"
when: always
source: Vergnaud
---
when: [always] · tier: standard · check: judgeable
An `as` cast (excluding `as const`) is either erasing information the type checker already proved wrong — a defect — or bridging a genuine gap the checker can't see across, which must be named at the cast site.
WRONG:
```ts
const config = rawConfig as AppConfig; // silences a real mismatch
const el = document.getElementById('x') as HTMLInputElement; // could be null, could be a <div>
```
RIGHT:
```ts
// getElementById can't know the DOM's static markup — assertion documents that gap
const el = document.getElementById('x');
if (!(el instanceof HTMLInputElement)) return { ok: false, error: { kind: 'MissingInput' } };
// el is now HTMLInputElement via a real runtime check, no cast needed
```
_Avoid_: `as` used to silence a type error rather than to encode a fact the compiler structurally cannot infer (DOM queries, `JSON.parse`, index signatures the compiler over-widens).
Detect: count `as` casts per file; for each, check whether an `instanceof`/discriminant check or schema parse could replace it — if yes, the cast is masking a validation gap, not bridging one.
Not-when: `as const` (a different operator — it narrows literals, it doesn't erase safety) or a narrowing cast immediately preceded by the runtime check that justifies it in the same expression.
