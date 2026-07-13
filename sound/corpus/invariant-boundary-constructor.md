---
paths: "**/*.{ts,tsx}"
when: always
source: Evans + Vernon
---
when: [always] · tier: standard · check: deterministic
A type that enforces a domain rule/invariant is built and mutated through exactly ONE named factory per type that states the rule — never a raw constructor, object literal, or spread from outside its own module, and the invariant is never re-checked ad hoc at each call site.
WRONG:
```ts
const order = new Order(id, customerId, items, "pending", null, false);
// booleans/nulls threaded through construction to fake a state the type should own
```
WRONG (different situation — the invariant re-checked per call site instead of enforced once):
```ts
if (data.total > 0) db.save({ ...draft, status: 'placed' })
// ...the same total>0 check re-appears at another call site, bypassable via spread
```
RIGHT:
```ts
const Order = {
  place: (data: DraftOrder): Result<Order, OrderInvariantViolation> => /* the one seam */ ...
}
// (status starts "pending", always)
```
_Avoid_: exported classes with public multi-arg constructors (3+ positional params) callable from outside their own module; exported object-literal constructors for an aggregate; `{ ...order, status: X }` spread from outside the aggregate's module; booleans or nulls threaded through construction to represent a state the type should already know.
Detect: `new <PascalCase>(` call sites outside the type's own module; constructors/object literals with 3+ positional or unlabeled fields; an aggregate-shaped value built or mutated via object literal / spread in a module that doesn't own that type; the same invariant check re-appearing at 2+ call sites.
Not-when: the type is a plain data record / DTO with no invariant to protect (a wire-schema shape passed straight through); read-only projections / DTOs.
