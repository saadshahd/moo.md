When one operation must happen before another is legal to call (init before use, open before write), encode that ordering in the types the first call returns — never in documentation or a runtime "not initialized" throw.
_Avoid_: a boolean flag (`isOpen`, `isInitialized`) gating a method body at runtime; a comment stating call order instead of the return type enforcing it.
Detect: a runtime guard whose failure message is a call-order instruction ("call X before Y"); a class/module with a private flag toggled by one method and checked by another.
Not-when: the ordering is a single always-true call at process startup with one caller (the composition root) — that's wiring, not an API contract other callers will violate.
