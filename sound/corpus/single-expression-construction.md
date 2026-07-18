---
paths: "**/*.{ts,tsx}"
when: always
source: house
---
when: [always] · tier: standard · check: judgeable
Build derived data as a single expression — a chained transformation (`filter`/`map`/`reduce` or a `pipe()`) or one constructor call over a mapped source — rather than allocating an empty container and mutating it into shape in a loop. If the construction genuinely needs multiple statements, the intermediate value that forces them deserves its own name — extract it, then build the final structure from it in one expression.
WRONG:
```ts
const names = [];
for (const u of users) {
  if (u.active) names.push(u.name.toUpperCase()); // a push-loop whose only job is to build a return value
}
const byId = new Map();
for (const item of items) byId.set(item.id, item); // allocate-then-mutate from a source already in hand
```
RIGHT:
```ts
const names = users.filter((u) => u.active).map((u) => u.name.toUpperCase());
const byId = new Map(items.map((x) => [x.id, x]));
```
_Avoid_: a `let result = []` / `new Map()` / `new Set()` / `{}` declared empty then filled by a loop whose only effect is to `push`/`.set`/`.add`/index-assign derived values from a source already in hand.
Detect: an empty collection literal immediately followed by a loop whose sole effect is to populate it — the whole block collapses to a chained transformation or one constructor call over a mapped source.
Not-when: the loop performs genuine side effects (IO, logging, an early `break` on an external condition) rather than building a return value; the entries come from more than one source merged conditionally; or the accumulation is a true fold whose per-step cost makes a `reduce` less readable than the loop.
