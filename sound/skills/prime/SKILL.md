---
name: prime
description: Use in a repo that has sound taste rules installed (a `.claude/sound/` directory), before writing or editing code — at the start of a coding task, and again when the work reaches a surface it was not planned to touch.
---

# sound:prime

If the repo has no `.claude/sound/` directory, it carries no sound taste rules — do nothing.

Otherwise: the project's taste rules live under `.claude/sound/`, grouped into topic folders (`<topic>/<rule-name>.md`). Before you write, browse the tree to see which topics bear on the surfaces you'll touch. Read a rule's file when its situation comes up, and make sure your code meets every rule that governs a surface you change. If the work reaches a surface you had not planned to touch, browse the tree again for that surface before writing it.

When two rules pull opposite ways on one surface, check each rule's Not-when and Cross-ref first — most conflicts are already carved there. Where none applies, the rule protecting correctness or debuggability outranks the one protecting style.
