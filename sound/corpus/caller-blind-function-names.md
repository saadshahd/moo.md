---
paths: "**/*.{ts,tsx}"
when: always
source: house
topic: naming
---
when: [always] · tier: standard · check: judgeable
A function's name describes what it DOES, not where it's USED, and makes sense without knowing the caller. If removing the call site makes the name nonsensical, the name is wrong.
WRONG:
```ts
function handleProfileSaveClick(profile: Profile) {}
function formatPriceForCartItem(cents: number) {}
```
RIGHT:
```ts
function save(profile: Profile) {}
function formatCurrency(cents: number) {}
```
_Avoid_: names that embed a call site, an event, or a feature — `handle*Click`, `*ForCartItem`, `*OnSubmit`, `*ForModal`.
Detect: read the name with every call site deleted; if it no longer describes the operation, it encodes a caller. UI-event prefixes (`handle`, `on`) and `For<Feature>` suffixes on non-handler functions are a first-pass filter.
Not-when: a genuine DOM/framework event handler whose whole job is to bridge an event — a bare `onClick` prop handler may legitimately read as `handleSubmit` at the boundary.
