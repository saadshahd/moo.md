---
when: distributed
source: Lamport
topic: consistency
---
The property that must NEVER be violated is written once as a pure predicate over state, named, and asserted at the boundary where state changes — before the mechanism that maintains it is coded.
_Avoid_: a state-mutating boundary in a multi-writer/replicated context with no named predicate expressing what must always hold; correctness described only in comments or a doc.
Detect: for load-bearing distributed state, whether a named `State => boolean` (or `=> Result`) invariant exists and is evaluated at the transition, versus the property living only in prose. This is the Lamport rule: separate the *what-must-hold* (safety) from the *how*, and make the what checkable. Distinguish it in naming from a liveness property (eventually-progresses) — the two are enforced differently and must not be conflated.
Not-when: throwaway rigor, or local single-writer state where the type system already makes the illegal state unrepresentable (then the union *is* the invariant — don't add a redundant predicate).
