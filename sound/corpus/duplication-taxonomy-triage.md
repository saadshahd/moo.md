---
when: always
source: Fowler
topic: abstraction
---
A single duplicated concept (not just duplicated text) is a defect — the cost of extraction is always less than the cost of divergence. The duplicate is often a decision, not a string: the same domain predicate re-derived per call site, or an invariant re-checked at 2+ call sites instead of enforced once at its constructor.
_Avoid_: re-deriving the same predicate with slightly different clauses per call site; a threshold or business rule expressed as a literal in more than one file.
Detect: two or more `if`/ternary chains that reference the same 2+ domain fields together, even with different variable names or added/dropped clauses — a copy-paste detector won't flag this because the text differs; you have to read for the decision, not the syntax; or the same invariant/guard (a `total > 0`, a status gate) re-appearing at 2+ call sites — that check belongs once at the aggregate's constructor.
Not-when: the resemblance is coincidental — two unrelated domain rules that happen to share a shape today but have no reason to change together tomorrow.
Cross-ref: complecting-shared-construct-split-by-reason-to-change — the inverse move: splitting one over-merged construct rather than extracting a duplicated concept; invariant-boundary-constructor — where an invariant re-checked per call site is enforced once instead.
