---
paths: "**/*.{ts,tsx}"
when: always
source: house
topic: abstraction
---
when: [always] · tier: standard · check: judgeable
Reach for an inert tagged corpus plus one member-blind interpreter ONLY when the member set BOTH grows over time AND its members carry behavior — otherwise never. When you do, model it as a discriminated union paired with a `Record` keyed by the tag, so a missing member is a COMPILE error, not a runtime surprise. NEVER build an interpreter for a closed or low-variance choice — variant props or a typed map read clearer.
_Avoid_: a `switch`-driven interpreter over a fixed, low-variance case set; a member-blind engine installed for a member set that isn't actually growing.
Detect: an interpreter/handler-map abstraction whose tag set is closed and small — ask whether the set genuinely keeps growing AND each member brings its own behavior; if not both, collapse it to variant props or a plain typed map.
Not-when: the member set truly is open and behavior-carrying (a plugin registry, a rule corpus) — then the union + tag-keyed `Record` is correct precisely because it makes a forgotten member a compile error.
Cross-ref: static-domain-tables-use-as-const-satisfies — the typing of the Record; exhaustiveness-is-a-compile-error-not-a-runtime-throw — the compile-error guarantee; abstraction-earns-existence — the smell of installing this before the trigger.
