A test of a failure asserts the error variant callers branch on — its type, code or tag — never its message text, which changes freely.
_Avoid_: `toThrow('Invalid user id')`, `expect(error.message).toBe(...)`, a snapshot of an error string, a regex over a message.
Detect: a failure test whose only assertion matches message text where the error carries a type, code or discriminant.
Not-when: the message is the contract — a CLI's error a user or agent reads, a parser's diagnostic; or the failure has no variant yet (a foreign throw) — then give it one at the adapter's `catch` (eliminate-mask-then-surface) and assert that.
Cross-ref: eliminate-mask-then-surface — the `Result` whose `E` names the variants callers branch on.
