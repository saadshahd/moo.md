---
paths: "**/*.{ts,tsx}"
when: always
source: house
---
when: [always] · tier: standard · check: judgeable
Construct a data structure in a single expression rather than allocating an empty container and mutating it into shape. If the construction genuinely needs multiple statements, the intermediate value that forces them deserves its own name — extract it, then build the final structure from it in one expression.
WRONG:
```ts
const byId = new Map();
for (const item of items) {
  byId.set(item.id, item);
}
```
RIGHT:
```ts
const byId = new Map(items.map((x) => [x.id, x]));
```
_Avoid_: `new Map()` / `new Set()` / `{}` / `[]` declared empty, then filled by a loop of `.set`/`.add`/index assignment when the source is already in hand.
Detect: an empty collection literal immediately followed by a loop whose only effect is to populate it — the whole block collapses to one constructor call over a mapped source.
Not-when: the entries come from more than one source that must be merged conditionally, or a truly multi-stage build where each stage is a named value feeding the next.
