---
paths: "**/*.{ts,tsx}"
when: always
source: house
---
when: [always] · tier: standard · check: judgeable
Transform data with chained methods (`filter`, `map`, `reduce`) or a `pipe()` composition. Never build up an array with an imperative loop and `push`.
WRONG:
```ts
const names = [];
for (const u of users) {
  if (u.active) names.push(u.name.toUpperCase());
}
```
RIGHT:
```ts
const names = users
  .filter((u) => u.active)
  .map((u) => u.name.toUpperCase());
```
_Avoid_: a `let result = []` (or `const` array) followed by a loop whose body's only job is to `push` derived values into it.
Detect: an array declared empty then populated inside a `for`/`while` loop with `.push`.
Not-when: the loop performs genuine side effects (IO, logging, early `break` on an external condition) rather than building a return value, or the accumulation is a true fold whose per-step cost makes a `reduce` less readable than the loop.
