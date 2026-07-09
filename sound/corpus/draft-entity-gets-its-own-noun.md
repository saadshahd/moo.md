---
paths: "**/*.{ts,tsx}"
when: always
source: house
---
when: [always] · tier: standard · check: judgeable
A draft or in-flight entity gets its own domain noun (`draftOrder`, `beingMadeMove`), never the committed type plus an `isEditing` flag. An entity mid-mutation is a distinct state, not a decorated copy of the committed one.
WRONG:
```ts
type Order = { id: string; total: number; isEditing?: boolean };
```
RIGHT:
```ts
type DraftOrder = { total: number };
type Order = { id: string; total: number };
```
_Avoid_: a committed type carrying `isEditing`, `isDraft`, `pending?`, or `unsaved?` flags to stand in for an in-flight variant.
Detect: an entity type with an `isEditing`/`isDraft`/`unsaved` boolean whose truthiness changes which other fields are meaningful — that is a hidden second state wanting its own noun.
Cross-ref: discriminated-union-over-flag-bag — the type-level form of the same rule.
