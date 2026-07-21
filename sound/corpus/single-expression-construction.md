---
when: always
source: house
topic: control-flow
---
Build derived data as a single expression — a chained transformation (`filter`/`map`/`reduce` or a `pipe()`) or one constructor call over a mapped source — rather than allocating an empty container and mutating it into shape in a loop. If the construction genuinely needs multiple statements, the intermediate value that forces them deserves its own name — extract it, then build the final structure from it in one expression.
_Avoid_: a `let result = []` / `new Map()` / `new Set()` / `{}` declared empty then filled by a loop whose only effect is to `push`/`.set`/`.add`/index-assign derived values from a source already in hand.
Detect: an empty collection literal immediately followed by a loop whose sole effect is to populate it — the whole block collapses to a chained transformation or one constructor call over a mapped source.
Not-when: the loop performs genuine side effects (IO, logging, an early `break` on an external condition) rather than building a return value; the entries come from more than one source merged conditionally; or the accumulation is a true fold whose per-step cost makes a `reduce` less readable than the loop.
