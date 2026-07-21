---
paths: "**/*.{ts,tsx}"
when: always
source: house
topic: control-flow
---
when: [always] · tier: standard · check: judgeable
Express validation and policy as typed records interpreted by ONE engine — never scatter `if`-checks for a policy that has more than one rule. The policy must be inspectable as data, not reconstructed by reading code paths. Before writing a conditional chain for a policy, look for the declarative form.
_Avoid_: a function whose body is a wall of `if (...) return reject(...)` for a multi-rule policy; the same policy re-expressed as branches in more than one place.
Detect: a sequence of independent `if` guards that each reject/accept against one policy — they collapse into a rules array walked by a single evaluator.
Not-when: a single condition, or genuinely unrelated branches that don't form one inspectable policy.
Cross-ref: restart-policy-as-data — the same shape applied to supervision policy; lookup-table-over-conditional-chain — the degenerate case where the rule is a pure static mapping.
