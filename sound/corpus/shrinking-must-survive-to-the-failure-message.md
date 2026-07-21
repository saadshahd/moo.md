---
paths: "**/*.{test,spec}.{ts,tsx}"
when: always
source: Hughes
topic: tests
---
When a property fails, the test output must show the shrunk minimal counterexample, not the first randomly-generated failing input — never disable shrinking or catch-and-summarize the failure in a way that discards it.
_Avoid_: a try/catch wrapped around the property runner that swallows or re-summarizes the thrown error instead of letting it propagate with the runner's counterexample+seed report.
Detect: property-runner calls wrapped in try/catch in test code, or generators with shrinking disabled applied outside an explicit "this domain has no meaningful minimal case" justification.
Not-when: the generator is over an unshrinkable domain by nature (a cryptographic key, a UUID) where a "smaller" counterexample carries no diagnostic value — explicit shrink-disabling there is correct, not a violation.
