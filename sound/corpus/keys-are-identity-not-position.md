---
paths: "**/*.{tsx,jsx}"
when: react
source: Abramov
---
when: [react] · tier: standard · check: judgeable
A list `key` must be a stable identifier of the item's identity across renders — never the array index, and never regenerated per render.
WRONG:
```tsx
{items.map((item, i) => <Row key={i} {...item} />)}
```
RIGHT:
```tsx
{items.map((item) => <Row key={item.id} {...item} />)}
```
_Avoid_: `key={index}`, `key={i}`, or `key={Math.random()}` / `key={crypto.randomUUID()}` computed inline during render.
Detect: grep JSX for `key={` and check the expression references the map callback's index parameter, or a freshly-generated value, rather than a field pulled from the item itself.
Not-when: the list is provably static and never reorders, filters, or has items inserted/removed mid-list (index and identity coincide permanently) — rare enough that it should be commented as WHY, not assumed.
