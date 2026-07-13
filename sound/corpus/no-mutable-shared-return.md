---
paths: "**/*.{ts,tsx}"
when: always
source: Bloch
---
when: [always] · tier: standard · check: deterministic
A module function that returns a structure a caller might hold onto returns an immutable value — never a shared mutable object another part of the system can still write through.
WRONG:
```ts
const cache = new Map<string, Order[]>()
const ordersFor = (userId: string) => cache.get(userId) ?? []
// caller does ordersFor(id).push(newOrder) — corrupts the cache silently
```
RIGHT:
```ts
const ordersFor = (userId: string): readonly Order[] => Object.freeze([...(cache.get(userId) ?? [])])
```
_Avoid_: returning a live reference into internal state (a `Map`, an array field, a class instance) without a defensive copy; a return type that omits `readonly` on a value the caller has no business mutating.
Detect: a function returning a reference type without `readonly`/`Readonly<T>` where the underlying value is also held internally (a cache, a singleton, a closure variable) — a caller mutation would leak back.
Not-when: the value is freshly constructed per call from primitives with no shared internal storage — there's nothing to leak.
