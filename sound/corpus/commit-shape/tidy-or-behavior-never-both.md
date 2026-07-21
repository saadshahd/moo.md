A single commit either restructures code with no behavior change, or changes behavior with no structural cleanup riding along — never both, because a failing test after a mixed commit can't tell you which change broke it.
_Avoid_: a commit message with both a refactor verb ("extract", "rename", "inline") and a behavior verb ("fix", "add", "change").
Detect: per-commit diff — do the touched lines include both a rename/move (detectable via git's move-detection or near-identical line matches elsewhere in the diff) and a line whose logic/branching actually differs, not just relocates.
Not-when: the tidy is a genuinely mechanical, tool-applied rename (e.g. an IDE rename-symbol across a whole repo) landing in its own commit anyway — still separate, just cheap to separate.
