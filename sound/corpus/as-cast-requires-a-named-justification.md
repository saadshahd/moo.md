---
when: always
source: Vergnaud
topic: types
---
Any move that silences the type checker — an `as` cast (excluding `as const`), `any`, `@ts-ignore`/`@ts-expect-error`, or widening a type to swallow a mismatch — is either erasing information the checker already proved wrong (a defect) or bridging a genuine gap it can't see across, which must be named at the silencing site.
_Avoid_: any checker-silencing (`as`, `any`, `@ts-ignore`, `@ts-expect-error`, a widened union/optional) used to quiet an error rather than to encode a fact the compiler structurally cannot infer (DOM queries, `JSON.parse`, index signatures it over-widens); a bare `@ts-ignore`/`@ts-expect-error` with no adjacent comment naming why.
Detect: count `as` casts, `any` annotations, and `@ts-ignore`/`@ts-expect-error` directives per file; for each, check whether an `instanceof`/discriminant check or schema parse could replace it — if yes, it is masking a validation gap, not bridging one; a suppression directive with no adjacent justification is always the defect form.
Not-when: `as const` (a different operator — it narrows literals, it doesn't erase safety) or a narrowing cast immediately preceded by the runtime check that justifies it in the same expression.
