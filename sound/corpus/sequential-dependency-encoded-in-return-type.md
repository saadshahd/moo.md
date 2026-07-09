---
paths: "**/*.{ts,tsx}"
when: distributed
source: Bloch
---
when: [distributed] · tier: standard · check: judgeable
When one operation must happen before another is legal to call (init before use, open before write), encode that ordering in the types the first call returns — never in documentation or a runtime "not initialized" throw.
WRONG:
```ts
const Connection = { open: (): void => { /* ... */ }, write: (data: Buffer): void => {
  if (!isOpen) throw new Error('call open() first') // caller finds out at runtime
}}
```
RIGHT:
```ts
type ClosedConn = { tag: 'closed'; open: () => OpenConn }
type OpenConn = { tag: 'open'; write: (data: Buffer) => Result<void, WriteError> }
const Connection = { closed: (): ClosedConn => ({ tag: 'closed', open: () => ({ tag: 'open', write }) }) }
// write is only reachable through the value open() returned — no "forgot to open" state exists
```
_Avoid_: a boolean flag (`isOpen`, `isInitialized`) gating a method body at runtime; a comment stating call order instead of the return type enforcing it.
Detect: a runtime guard whose failure message is a call-order instruction ("call X before Y"); a class/module with a private flag toggled by one method and checked by another.
Not-when: the ordering is a single always-true call at process startup with one caller (the composition root) — that's wiring, not an API contract other callers will violate.
