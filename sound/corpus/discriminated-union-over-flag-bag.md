---
when: always
source: house
topic: types
---
Model mutually-exclusive domain states as a discriminated union tagged by a discriminant field (`status`, `type`, `kind`, `tag`), where each variant carries only the data valid in that state. Never represent distinct states as one flat type with optional fields.
_Avoid_: a record of optional fields where certain combinations are meaningless or contradictory; a boolean pair (`isLoading` + `isError`) standing in for one three-state axis.
Detect: a type with 2+ optional fields whose presence is correlated (one implies another absent), or a comment/guard reconstructing "if data then not loading" — the invariant the type failed to encode.
Not-when: the optional fields are truly independent and any combination is legal — those are separate axes, not one state, and stay as separate fields.
Cross-ref: illegal-input-unrepresentable-not-validated — the construction-time twin; exhaustiveness-is-a-compile-error-not-a-runtime-throw — how consumers stay total over the union.
