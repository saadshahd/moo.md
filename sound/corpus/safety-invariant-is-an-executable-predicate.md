---
paths: "**/*.{ts,tsx}"
when: distributed
source: Lamport
---
when: [distributed] · tier: high-stakes · check: judgeable
The property that must NEVER be violated is written once as a pure predicate over state, named, and asserted at the boundary where state changes — before the mechanism that maintains it is coded.
WRONG:
```ts
// "a seat is never double-booked" — enforced by reading the booking code and trusting it
function book(seat, user) { seats[seat] = user }
```
RIGHT:
```ts
// noDoubleBooking :: State => boolean   (the safety property, stated first)
const noDoubleBooking = (s: State) =>
  new Set(s.bookings.map(b => b.seat)).size === s.bookings.length
function book(s: State, cmd: Book): Result<State, InvariantBroken> {
  const next = { ...s, bookings: [...s.bookings, cmd] }
  return noDoubleBooking(next) ? { ok: true, value: next } : { ok: false, error: 'InvariantBroken' }
}
```
_Avoid_: a state-mutating boundary in a multi-writer/replicated context with no named predicate expressing what must always hold; correctness described only in comments or a doc.
Detect: for load-bearing distributed state, whether a named `State => boolean` (or `=> Result`) invariant exists and is evaluated at the transition, versus the property living only in prose. This is the Lamport rule: separate the *what-must-hold* (safety) from the *how*, and make the what checkable. Distinguish it in naming from a liveness property (eventually-progresses) — the two are enforced differently and must not be conflated.
Not-when: throwaway rigor, or local single-writer state where the type system already makes the illegal state unrepresentable (then the union *is* the invariant — don't add a redundant predicate).
