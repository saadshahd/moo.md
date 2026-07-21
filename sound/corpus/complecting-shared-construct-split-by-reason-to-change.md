---
paths: "**/*.{ts,tsx}"
when: always
source: Hickey
topic: placement
---
When two properties, fields, or branches of one construct change for different reasons, that construct is complected, not cohesive — split it into two things joined by an explicit relationship.
_Avoid_: one type, one file, or one function whose edits are attributed in git blame to two unrelated feature teams or tickets.
Detect: grep the last N commits touching a file/type — if the diffs cluster into two causally unrelated stories (pricing changes vs. shipping changes) touching the *same* declared shape, that shape is complected.
Not-when: the fields co-occur because they are the SAME axis at different times (a state-modeling union) — that's cohesion, not complecting; the test is "different reasons," not "different fields."
Cross-ref: duplication-taxonomy-triage — the inverse move: that rule extracts one concept spread across copies; this rule splits one construct serving two reasons to change.
