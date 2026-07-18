---
paths: "**/*.{ts,tsx}"
when: always
source: Fowler + Feathers + Hickey
topic: abstraction
---
when: [always] · tier: standard · check: judgeable
Reserved machinery — an interface, strategy, plugin point, port, or wrapper — must earn its existence against a named trigger, judged by one ladder in order: (1) COUNT — a second consumer or concrete adapter already exists (a test double counts as one) → it has earned its place; (2) DATED TRIGGER — the second member is named in scoped, scheduled work today → a deliberate seam, and the schedule is its license; (3) otherwise the DELETION TEST rules — delete it mentally: if the complexity evaporates it was a pass-through, cut it; if the complexity reappears at N call sites it was load-bearing, keep it. The defect is never the seam itself — it is the unscheduled one.
WRONG:
```ts
interface DiscountStrategy { compute(amount: number): number }
class StandardDiscountStrategy implements DiscountStrategy { compute(a: number) { return a * 0.1; } }
const strategy: DiscountStrategy = new StandardDiscountStrategy(); // one impl, no second in sight
// or: a wrapper that exists because "we might swap providers later"
function sendEmail(msg: Msg) { return smtp.send(msg) }
```
RIGHT:
```ts
const computeDiscount = (amount: number) => amount * 0.1;
// promote to a Record<tag, fn> interpreter only when a second, behaviorally-different member shows up —
// or when two adapters exist NOW (production SMTP + test fake), which is the count the ladder wants:
interface EmailSender { send(msg: Email): Promise<void> }
class SmtpEmailSender implements EmailSender { /* prod */ }
class FakeEmailSender implements EmailSender { /* test — the second impl that earns the port */ }
```
_Avoid_: an `interface`/abstract base with exactly one non-test implementation; a `Record`/handler map with one key; a config option never read with any value but its default; a wrapper justified by a future ("we might", "in case", "for flexibility") instead of a present caller.
Detect: an interface, strategy class, or injected seam with exactly one implementation/provider and no second consumer — delete it mentally and see if any caller's code gets harder, not just longer. The one deletion-test-immune seam is dependency-at-the-edges (clock/random/id/network): its job is isolation, not indirection, so deleting it destroys the only test seam you have.
Not-when: the second member is named in scoped, scheduled work today — that's a deliberate seam (Fowler: prudent-deliberate technical debt), not speculative generality; the difference is whether you can name the trigger out loud, today, not whether the machinery is currently unused.
Cross-ref: colocate-then-lift-on-second-consumer — the [react] state instance of the same ladder; optimization-cites-a-measurement — the same defect on the performance axis, where the trigger is a measurement instead of a second consumer; data-as-spec-earns-its-trigger — when the tagged-corpus-plus-interpreter is genuinely the right shape.
