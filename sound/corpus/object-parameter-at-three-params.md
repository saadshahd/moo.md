---
paths: "**/*.{ts,tsx}"
when: always
source: house
topic: abstraction
---
Group a positional list the caller must order by memory into a single object parameter — a named domain concept, not a bare sequence of primitives.
_Avoid_: a function declaration with a positional run the caller must order by memory; a call site passing a run of bare literals whose meaning depends on position.
Detect: two positional args that share a type, or a boolean in the positional run — a call that transposes them still type-checks. That silent swap is the hit.
Not-when: the parameters are already one cohesive tuple with a conventional order (e.g. `(x, y, z)` coordinates), or a framework contract fixes the positional signature.
Cross-ref: data-clump-to-parameter-object — the cross-signature version: the same primitives recurring across 2+ signatures name a missing domain concept.
