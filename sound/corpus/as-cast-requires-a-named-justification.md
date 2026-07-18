---
paths: "**/*.{ts,tsx}"
when: always
source: Vergnaud
---
when: [always] · tier: standard · check: judgeable
Any move that silences the type checker — an `as` cast (excluding `as const`), `any`, `@ts-ignore`/`@ts-expect-error`, or widening a type to swallow a mismatch — is either erasing information the checker already proved wrong (a defect) or bridging a genuine gap it can't see across, which must be named at the silencing site.
WRONG:
```ts
const config = rawConfig as AppConfig; // silences a real mismatch
const el = document.getElementById('x') as HTMLInputElement; // could be null, could be a <div>
const data: any = JSON.parse(raw); // `any` erases every downstream check, not just this line
// @ts-ignore  ← suppresses the next line's error with no reason named
```
RIGHT:
```ts
// getElementById can't know the DOM's static markup — assertion documents that gap
const el = document.getElementById('x');
if (!(el instanceof HTMLInputElement)) return { ok: false, error: { kind: 'MissingInput' } };
// el is now HTMLInputElement via a real runtime check, no cast needed
```
_Avoid_: any checker-silencing (`as`, `any`, `@ts-ignore`, `@ts-expect-error`, a widened union/optional) used to quiet an error rather than to encode a fact the compiler structurally cannot infer (DOM queries, `JSON.parse`, index signatures it over-widens); a bare `@ts-ignore`/`@ts-expect-error` with no adjacent comment naming why.
Detect: count `as` casts, `any` annotations, and `@ts-ignore`/`@ts-expect-error` directives per file; for each, check whether an `instanceof`/discriminant check or schema parse could replace it — if yes, it is masking a validation gap, not bridging one; a suppression directive with no adjacent justification is always the defect form.
Not-when: `as const` (a different operator — it narrows literals, it doesn't erase safety) or a narrowing cast immediately preceded by the runtime check that justifies it in the same expression.
