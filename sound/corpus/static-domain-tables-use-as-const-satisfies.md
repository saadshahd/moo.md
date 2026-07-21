---
paths: "**/*.{ts,tsx}"
when: always
source: Vergnaud
topic: types
---
A fixed, compile-time-known lookup table (status → label, tier → limit, role → permissions) must be declared with `as const satisfies Record<Key, Shape>`, never typed by a separate `interface`/`type` annotation on the variable. Both forms check the keys; the annotation WIDENS every value — literal types are lost, and the table can no longer serve as a type source.
_Avoid_: `: Record<K, V>` as a variable annotation on a static object literal; a bare `as const` with no `satisfies` clause on data meant to conform to a shape.
Detect: an object literal assigned with a type annotation on the left of `=` instead of `satisfies` on the right, where the object's keys are meant to match a union type.
Not-when: the value is genuinely computed at runtime (built from an array, fetched, merged) rather than a literal — `satisfies` only helps on data written by hand as a literal.
