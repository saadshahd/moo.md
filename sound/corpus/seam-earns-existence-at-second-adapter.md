---
paths: "**/*.{ts,tsx}"
when: always
source: Feathers
---
when: [always] · tier: standard · check: judgeable
Don't introduce a port/interface abstraction for a dependency until a second concrete adapter exists or is imminently scheduled — production plus test counts as two, production plus one hypothetical future backend does not.
WRONG:
```ts
interface EmailSender { send(msg: Email): Promise<void> }
class SmtpEmailSender implements EmailSender { /* only impl */ }
// "in case we swap providers later"
```
RIGHT:
```ts
// Two adapters exist NOW: production SMTP + test fake.
interface EmailSender { send(msg: Email): Promise<void> }
class SmtpEmailSender implements EmailSender { /* prod */ }
class FakeEmailSender implements EmailSender { /* test */ }
```
_Avoid_: an `interface`/abstract base with exactly one non-test implementation; comments like "in case we need to swap" or "for future flexibility"
Detect: count concrete implementations of each interface/abstract class — flag any with fewer than 2 (a test double counts as one)
Not-when: the second adapter is a test double you are writing in the same change — that's still two, and satisfies the rule; this is about speculative production-only ports
Cross-ref: the delete-vs-date ladder (deletion-test-before-any-abstraction-ships · speculative-generality-guard · seam-earns-existence-at-second-adapter · colocate-then-lift-on-second-consumer): judge an unused abstraction in this order — (1) COUNT: a second consumer/adapter already exists (a test double counts) → it has earned existence; (2) DATED TRIGGER: the second member is named in scoped, scheduled work today → a deliberate seam; the schedule is the license; (3) otherwise the DELETION TEST rules → cut. The defect is never the seam itself — it is the unscheduled one.
