---
paths: "**/*.{ts,tsx}"
when: always
source: house
---
when: [always] · tier: standard · check: deterministic
Role suffixes live in the holder hierarchy — the folder or module — never the variable name. For a pure declarative record, `variableName === identityField === filename`, with NO role suffix tacked on: no `Config`, `Schema`, `Def`, `Spec`. The folder declares the role; the file repeating it is noise.
WRONG:
```ts
// file: rules/overLimitConfig.ts
export const overLimitConfig = { when: '...', reject: 'OVER_LIMIT' };
```
RIGHT:
```ts
// file: rules/overLimit.ts
export const overLimit = { when: '...', reject: 'OVER_LIMIT' };
```
_Avoid_: a declarative record's variable or filename ending in `Config`/`Schema`/`Def`/`Spec` when the containing folder already names that role.
Detect: an exported const whose name ends in a role suffix that duplicates its folder's role; a filename and identifier that disagree, or that carry a suffix the directory already supplies.
Not-when: the suffix distinguishes two genuinely different holders in the same scope (a `Schema` next to the `Type` it validates), not just decorating the role the folder already declares.
