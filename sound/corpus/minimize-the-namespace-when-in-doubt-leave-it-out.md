---
paths: "**/*.{ts,tsx}"
when: always
source: Bloch
topic: abstraction
---
when: [always] · tier: standard · check: deterministic
Export only what a caller currently needs from a module's namespace object — every export is a permanent promise, since removing one later is a breaking change for every caller, internal or external.
WRONG:
```ts
export const Invoice = {
  save, parse, validate,
  computeTaxInternal, roundToCents, isLegacyFormat, // never called outside this file
} as const
```
RIGHT:
```ts
// computeTaxInternal, roundToCents, isLegacyFormat stay unexported module-local fns
export const Invoice = { save, parse, validate } as const
```
_Avoid_: exporting a helper "in case something needs it later"; re-exporting a dependency's type or function through your namespace just because it was convenient at the call site.
Detect: an exported member of a namespace object with zero import sites outside its own module, or a re-export whose only purpose is passthrough.
Not-when: the module is an explicitly designated public entry point (e.g., a package's `index.ts`) whose whole job is re-exporting a curated surface.
