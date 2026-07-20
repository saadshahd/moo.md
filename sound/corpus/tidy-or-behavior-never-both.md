---
paths: "**/*.{ts,tsx}"
when: always
source: Beck
topic: commit-shape
---
when: [always] · tier: standard · check: deterministic
A single commit either restructures code with no behavior change, or changes behavior with no structural cleanup riding along — never both, because a failing test after a mixed commit can't tell you which change broke it.
WRONG:
```
commit: "rename computeTotal->deriveTotal, extract discount calc, fix rounding bug"
```
RIGHT:
```
commit: "tidy: rename computeTotal->deriveTotal, extract discount calc"
commit: "fix: round to nearest cent instead of truncating"
```
_Avoid_: a diff where renamed/moved lines and logic-changed lines appear in the same commit; a commit message with both a refactor verb ("extract", "rename", "inline") and a behavior verb ("fix", "add", "change").
Detect: per-commit diff — do the touched lines include both a rename/move (detectable via git's move-detection or near-identical line matches elsewhere in the diff) and a line whose logic/branching actually differs, not just relocates.
Not-when: the tidy is a genuinely mechanical, tool-applied rename (e.g. an IDE rename-symbol across a whole repo) landing in its own commit anyway — still separate, just cheap to separate.
