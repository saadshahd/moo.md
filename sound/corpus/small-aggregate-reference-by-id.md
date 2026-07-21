---
paths: "**/*.{ts,tsx}"
when: db
source: Vernon
topic: consistency
---
An aggregate holds only what's inside its own consistency boundary; anything outside it is referenced by a branded ID, never embedded as another aggregate's full type.
_Avoid_: a field on an aggregate typed as another aggregate's domain type instead of its ID.
Detect: a field inside an aggregate-shaped type whose type is another module's full domain type (not a `*Id` value object).
Not-when: read models/DTOs assembled for display — those exist to be denormalized and may embed nested data freely.
