---
paths: "**/*.{ts,tsx}"
when: always
source: Evans
topic: types
---
When two parts of the system use the same domain word for something that behaves differently in each, each side defines its own type for that word — never import one context's version of "Product"/"Order"/"User" into another context's domain logic.
_Avoid_: a domain module importing another domain module's entity type and reaching into fields that belong to the other context's concerns.
Detect: trace imports of exported domain types across module/folder boundaries; flag a consumer that only uses a subset of an imported type's fields — that subset is the real type it needed.
Not-when: the "shared" type is a genuinely cross-context primitive (an `Id`, a `Money` value object) with no context-specific behavior — those belong at the common ancestor per place-code-where-it-would-be-found, not duplicated.
Cross-ref: feature-envy-misplacement — same smell family, different move: when the mismatch is TYPE ownership (two contexts sharing one domain word), each context defines its own type and translates at the boundary (this rule); when it is FUNCTION placement (a function reading mostly another domain's fields), move the function to the domain it envies.
