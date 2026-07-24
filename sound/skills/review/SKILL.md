---
name: review
description: Use when reviewing a staged diff or a commit range for soundness against the project's taste rules, including a pre-commit pass or an explicit "sound review".
---

# sound:review

## What to read

- **No argument** → `git diff --cached`.
- **A range** (e.g. `main..HEAD`) → its commits and the whole `git diff <range>`.

## How to review

The project's taste rules live under `.claude/sound/`. Read the ones that bear on the code the diff touches, and apply each rule's `Detect:` and `Not-when:` **verbatim** — never from memory. If `.claude/sound/` is absent, say so and stop.

Review deeply: surface every rule the changes violate, and the enhancements that genuinely matter for this diff's kind. Ground every finding in the diff and the intent behind it — never rule from the text alone. Stay silent where a rule's `Not-when:` applies.

Report most-consequential first: `- <file>: <rule or enhancement> — <anchor>`. If nothing stands, say `CLEAN`.
