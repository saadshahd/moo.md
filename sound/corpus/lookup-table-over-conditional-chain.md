---
paths: "**/*.{ts,tsx}"
when: always
source: house
topic: control-flow
---
When the keys are known at compile time, map them with an object or `Map` lookup — never a `switch` or an `if/else` chain.
_Avoid_: a `switch` over a string/enum discriminant or an `if/else` ladder comparing one variable against compile-time-known constants.
Detect: grep for `switch` and chained `else if` where each arm tests the same variable against a literal — a keyed lookup replaces the whole block.
Not-when: the arms do genuinely different work (not just return different values), fall through, or branch on runtime-computed conditions rather than a fixed key set.
Cross-ref: static-domain-tables-use-as-const-satisfies — the typing discipline for the table itself (as const satisfies).
