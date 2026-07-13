---
paths: "**/*.{ts,tsx}"
when: always
source: Hickey
---
when: [always] · tier: standard · check: judgeable
Before a module, wrapper, or interpreter is allowed to exist, ask what happens if you delete it: if the complexity it holds evaporates, it was a pass-through — cut it; if the complexity reappears at N call sites, it was load-bearing — keep it.
WRONG:
```ts
// exists because "we might swap providers later"
function sendEmail(msg: Msg) { return smtp.send(msg) }
```
RIGHT:
```ts
// two providers already exist, callers branch on capability today
function sendEmail(msg: Msg) { return activeProvider.send(msg) }
```
_Avoid_: comments or PR text justifying a wrapper with a future ("we might", "in case", "for flexibility") instead of a present caller.
Detect: a module with exactly one implementation, one caller pattern, and no divergent behavior across its call sites — delete it mentally and see if any caller's code gets harder, not just longer.
Not-when: the wrapper is the named seam for dependency-at-the-edges (clock/random/id/network) — that one is deletion-test-immune because its job is isolation, not indirection; deleting it doesn't concentrate complexity, it destroys the only test seam you have.
Cross-ref: the delete-vs-date ladder (deletion-test-before-any-abstraction-ships · speculative-generality-guard · seam-earns-existence-at-second-adapter · colocate-then-lift-on-second-consumer): judge an unused abstraction in this order — (1) COUNT: a second consumer/adapter already exists (a test double counts) → it has earned existence; (2) DATED TRIGGER: the second member is named in scoped, scheduled work today → a deliberate seam; the schedule is the license; (3) otherwise the DELETION TEST rules → cut. The defect is never the seam itself — it is the unscheduled one.
