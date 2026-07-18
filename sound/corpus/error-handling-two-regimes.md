---
paths: "**/*.{ts,tsx}"
when: always
source: Armstrong, house
topic: effects
---
when: [always] · tier: standard · check: judgeable
The eliminate → mask → surface ladder governs in-process logic for enumerable failures — there, no throw, no try/catch. At a unit boundary (worker loop top, job runner, composition root) an UNenumerated failure — a bug, a poisoned message, a violated invariant — must escape and kill the unit. It must never be converted to a Result that lets the loop keep running. The only legal catch lives at the boundary, and it must END in termination, dead-letter, or rethrow. Discriminating question: is the failure enumerable or not, and does the catch continue the loop?
WRONG:
```ts
while (true) {
  const msg = await queue.next();
  try { await handle(msg); }
  catch (e) { log(e); continue; } // keeps a corrupt process alive on a poisoned message
}
```
RIGHT:
```ts
// enumerable failures surface as data; unenumerated ones crash the unit clean
while (true) {
  const msg = await queue.next();
  const result = await handle(msg); // returns Result<Ack, KnownError>; may throw on a bug
  if (!result.ok) reportKnown(result.error);
}
// supervision — queue redelivery, a process manager — is the recovery layer, not code
```
_Avoid_: a catch that logs and continues the enclosing loop; a Result whose `E` includes failures no caller can act on; defensive catch-all that pretends nothing happened.
Detect: a catch block whose control flow continues the enclosing loop; a Result whose `E` includes failures no caller can act on.
Not-when: enumerable in-process failures with a caller that can branch — those stay on the ladder, not the boundary.
Cross-ref: eliminate-mask-then-surface — the in-process regime this bounds; per-unit-crash-isolation and restart-policy-as-data — the supervision layer that makes crashing clean safe.
