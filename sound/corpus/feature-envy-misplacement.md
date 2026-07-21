---
paths: "**/*.{ts,tsx}"
when: always
source: Fowler
topic: placement
---
when: [always] · tier: standard · check: judgeable
A function that reads more fields from another module's domain object than it uses of its own state belongs in that other module — its field accesses tell you where it should live, so move it there.
_Avoid_: a function in module A whose body's field accesses are majority-owned by module B's type.
Detect: count property accesses per source object inside a function body — if a foreign object's fields outnumber the function's own module's fields, that's envy; also watch for a function taking 2+ domain objects as params where only one is truly needed by the caller.
Not-when: the function is an explicit adapter/mapper whose entire job is translating between two domains (e.g., a DTO mapper) — envy is expected there.
Cross-ref: place-code-where-it-would-be-found — the placement rule this smell locates violations of. bounded-context-owns-its-type — same smell family, different move: when the mismatch is FUNCTION placement (a function reading mostly another domain's fields), move the function to the domain it envies (this rule); when it is TYPE ownership (two contexts sharing one domain word), each context defines its own type and translates at the boundary.
