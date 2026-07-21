---
paths: "**/*.{ts,tsx}"
when: always
source: house
topic: naming
---
when: [always] · tier: standard · check: judgeable
Shorter is better until ambiguous. Stop at the first name that is unambiguous in its module scope — extra qualifiers past that point are noise.
_Avoid_: qualifiers that restate the module (`parseUserFormInput` inside a form module), or that disambiguate against a collision that does not exist in scope.
Detect: for each qualifier in a name, ask whether dropping it creates a real collision within the same module; if not, the qualifier is padding. `parse` > `parseInput` > `parseUserFormInput` — stop at the first that is clear.
Not-when: two distinct operations in the SAME module genuinely need the qualifier to tell them apart (`parseHeader` vs `parseBody`).
