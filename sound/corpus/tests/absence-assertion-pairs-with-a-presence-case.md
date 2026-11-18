An assertion that something never happens — no call, no error, no element, no log line — passes on a dead path, so pair it with a case where the same check does see the thing; a test that asserts removed code or an old path stays gone has no such case and guards no behavior: delete it.
_Avoid_: `expect(spy).not.toHaveBeenCalled()`, `not.toBeInTheDocument()` or `not.toThrow()` with no sibling case where the positive form passes; a test named for code that no longer exists ("no longer calls legacyX", "old endpoint is gone").
Detect: a negative assertion whose spy, selector or matcher appears in no positive assertion in the same file; a test whose subject is an identifier or path absent from the source.
Not-when: a sibling case already shows the same check firing — the pair exists, and the absence is the contract (a denied permission beside an allowed one).
Cross-ref: test-observable-behavior-not-structure — the break-it check that exposes a test which cannot fail.
