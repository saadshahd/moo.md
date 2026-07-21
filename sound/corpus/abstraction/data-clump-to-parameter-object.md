The same group of primitives recurring together across 2+ signatures is a data clump — usually an unnamed domain concept, not just an ergonomics complaint. The trigger is not the parameter count on any one signature; it is the recurrence of the group across signatures.
_Avoid_: the same 2+ primitive parameters appearing in the same relative order across unrelated function signatures.
Detect: grep function signatures for repeated parameter-type sequences (e.g., `string, string, string` in the same positions) across more than one file — if the clump survives a rename of one call site's variable names, it's structural, not coincidental.
Not-when: a single function with a positional run a caller must order by memory that doesn't recur elsewhere — that is the single-signature grouping handled by object-parameter-at-three-params, not a recurring data clump.
Cross-ref: object-parameter-at-three-params — the single-signature grouping rule this extends across signatures.
