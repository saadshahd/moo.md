---
when: always
source: Hughes
topic: tests
---
Three or more test cases in one `describe` block that differ only in the literal input/output values, not in the assertion shape, are one un-stated universal property wearing example-test clothing — extract the property and delete the examples it subsumes.
_Avoid_: a run of `test(...)` calls in the same file with structurally identical bodies and only the numeric/string literals varying.
Detect: within one `describe`, count assertion bodies with identical AST shape modulo literals — 3+ is the threshold; the property that generalizes them is missing from the file.
Not-when: each case exercises a genuinely distinct code path (a different branch, a different error type) rather than the same computation at a different value — that's boundary/branch coverage, not a hidden property, and stays example-based.
Cross-ref: one-behavior-per-test — cases differing in code PATH (branch taken / error type) stay as named one-behavior examples; cases differing only in LITERALS collapse to one extracted property.
