---
paths: "**/*.{ts,tsx}"
when: always
source: house
---
when: [always] · tier: standard · check: deterministic
When the keys are known at compile time, map them with an object or `Map` lookup — never a `switch` or an `if/else` chain.
WRONG:
```ts
function label(status: OrderStatus) {
  if (status === 'pending') return 'Pending';
  if (status === 'shipped') return 'Shipped';
  if (status === 'delivered') return 'Delivered';
}
```
RIGHT:
```ts
const labels = {
  pending: 'Pending',
  shipped: 'Shipped',
  delivered: 'Delivered',
} as const satisfies Record<OrderStatus, string>;

const label = (status: OrderStatus) => labels[status];
```
_Avoid_: a `switch` over a string/enum discriminant or an `if/else` ladder comparing one variable against compile-time-known constants.
Detect: grep for `switch` and chained `else if` where each arm tests the same variable against a literal — a keyed lookup replaces the whole block.
Not-when: the arms do genuinely different work (not just return different values), fall through, or branch on runtime-computed conditions rather than a fixed key set.
Cross-ref: static-domain-tables-use-as-const-satisfies — the typing discipline for the table itself (as const satisfies).
