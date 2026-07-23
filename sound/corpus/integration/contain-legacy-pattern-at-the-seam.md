New or refactored code meets the standard even when adjacent legacy code doesn't — an incompatible pattern is translated at the nearest seam, never copied forward into new code for local consistency, and the change never grows to rewrite unrelated old code.
_Avoid_: a new function reproducing a neighbor's anti-pattern (throwing where the module now returns errors as values, a raw row passed inward) justified only by matching surrounding style; a scoped change whose diff restructures code the task never touched.
Detect: new or changed lines reproducing a defect the corpus names, with no cause but adjacent code doing the same; a diff whose touched surface exceeds the stated change.
Not-when: a migration explicitly scoped to convert the legacy pattern — atomicity-three-regimes governs the mechanic.
Cross-ref: seam-is-not-a-v2-interface — the seam discipline once a migration is chosen; tidy-or-behavior-never-both — the commit-shape half of scope discipline.
