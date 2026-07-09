---
paths: "**/*.{ts,tsx}"
when: always
source: Feathers
---
when: [always] · tier: throwaway · check: judgeable
When you don't yet understand unfamiliar code well enough to change it safely, do a throwaway refactor purely to build understanding — extract, rename, restructure freely — then discard it and make the real change from a position of clarity, never keeping the exploratory version as the shipped diff.
WRONG:
```ts
// spent 40 min renaming vars and extracting functions to "get a feel for it"
// then just... kept committing that same diff as the actual fix
```
RIGHT:
```ts
// scratch/understand-pricing.ts — exploratory only, deleted before commit
// after understanding gained, the REAL diff is small, targeted, and
// touches only what the actual fix requires
```
_Avoid_: committing an understanding-refactor as if it were the intended change; conflating "code I now understand" with "code that needed changing"
Detect: a shipped diff whose touched-file count/line count is far larger than what the stated bug/feature requires, with no test or behavior change justifying the extra churn
Not-when: the exploratory refactor's conclusion IS that the structure itself was the bug — then it graduates from scratch to real diff, but that's a deliberate decision, not a default
