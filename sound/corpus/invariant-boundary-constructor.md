---
paths: "**/*.{ts,tsx}"
when: always
source: Evans + Vernon
topic: types
---
A type that enforces a domain rule/invariant is built and mutated through exactly ONE named factory per type that states the rule — never a raw constructor, object literal, or spread from outside its own module, and the invariant is never re-checked ad hoc at each call site.
_Avoid_: exported classes with public multi-arg constructors (3+ positional params) callable from outside their own module; exported object-literal constructors for an aggregate; `{ ...order, status: X }` spread from outside the aggregate's module; booleans or nulls threaded through construction to represent a state the type should already know.
Detect: `new <PascalCase>(` call sites outside the type's own module; constructors/object literals with 3+ positional or unlabeled fields; an aggregate-shaped value built or mutated via object literal / spread in a module that doesn't own that type.
Cross-ref: duplication-taxonomy-triage — an invariant re-checked at 2+ call sites (rather than enforced once here) is a duplicated concept, triaged there.
Not-when: the type is a plain data record / DTO with no invariant to protect (a wire-schema shape passed straight through); read-only projections / DTOs.
