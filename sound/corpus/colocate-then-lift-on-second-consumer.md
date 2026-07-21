---
when: react
source: Abramov
topic: placement
---
State starts in the component that owns the interaction; lift it only when a second component genuinely needs to read or drive it — never lift preemptively "in case it's needed later."
_Avoid_: single-consumer state placed in a parent, context provider, or global store "for future flexibility."
Detect: for each piece of lifted state, count actual current call sites that read or write it — if the count is one, it's mis-colocated.
Not-when: two sibling components already both need it now (not hypothetically), or the state must survive the owning component's unmount (e.g. a wizard step surviving navigation) — that's a real lift, not premature one.
Cross-ref: abstraction-earns-existence — the general delete-vs-date ladder (count → dated trigger → deletion test); this rule is its [react] state instance (lift only on a real second consumer, never preemptively).
