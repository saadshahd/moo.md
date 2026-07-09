---
paths: "**/*.{ts,tsx}"
when: always
source: Vergnaud
---
when: [always] · tier: standard · check: deterministic
A fixed, compile-time-known lookup table (status → label, tier → limit, role → permissions) must be declared with `as const satisfies Record<Key, Shape>`, never typed by a separate `interface`/`type` annotation on the variable.
WRONG:
```ts
interface StatusConfig { label: string; color: string }
const statusConfig: Record<OrderStatus, StatusConfig> = {
  pending: { label: 'Pending', color: 'gray' },
  shiped: { label: 'Shipped', color: 'green' }, // typo — no error, key just isn't OrderStatus
};
```
RIGHT:
```ts
const statusConfig = {
  pending: { label: 'Pending', color: 'gray' },
  shipped: { label: 'Shipped', color: 'green' },
} as const satisfies Record<OrderStatus, { label: string; color: string }>;
// typo'd key -> compile error; values keep their literal types, not widened to string
```
_Avoid_: `: Record<K, V>` as a variable annotation on a static object literal; a bare `as const` with no `satisfies` clause on data meant to conform to a shape.
Detect: an object literal assigned with a type annotation on the left of `=` instead of `satisfies` on the right, where the object's keys are meant to match a union type.
Not-when: the value is genuinely computed at runtime (built from an array, fetched, merged) rather than a literal — `satisfies` only helps on data written by hand as a literal.
