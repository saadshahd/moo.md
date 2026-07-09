---
paths: "**/*.{ts,tsx}"
when: always
source: house
---
when: [always] · tier: standard · check: judgeable
Express validation and policy as typed records interpreted by ONE engine — never scatter `if`-checks for a policy that has more than one rule. The policy must be inspectable as data, not reconstructed by reading code paths. Before writing a conditional chain for a policy, look for the declarative form.
WRONG:
```ts
function validate(order: Order) {
  if (order.total > creditLimit) return reject('OVER_LIMIT');
  if (order.items.length === 0) return reject('EMPTY');
  if (!order.address) return reject('NO_ADDRESS');
}
```
RIGHT:
```ts
const rules = [
  { when: 'total exceeds credit limit', reject: 'OVER_LIMIT', test: (o: Order) => o.total > creditLimit },
  { when: 'order has no items', reject: 'EMPTY', test: (o: Order) => isEmpty(o.items) },
  { when: 'no shipping address', reject: 'NO_ADDRESS', test: (o: Order) => !o.address },
];
const validate = (o: Order) => rules.find((r) => r.test(o))?.reject;
```
The `when` predicates MAY be written as readable natural-language string literals so the rules array reads as domain documentation on its own, without opening the interpreter.
_Avoid_: a function whose body is a wall of `if (...) return reject(...)` for a multi-rule policy; the same policy re-expressed as branches in more than one place.
Detect: a sequence of independent `if` guards that each reject/accept against one policy — they collapse into a rules array walked by a single evaluator.
Not-when: a single condition, or genuinely unrelated branches that don't form one inspectable policy.
Cross-ref: restart-policy-as-data — the same shape applied to supervision policy; lookup-table-over-conditional-chain — the degenerate case where the rule is a pure static mapping.
