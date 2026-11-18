---
name: review
description: Use when reviewing a staged diff, a commit range or a whole test suite for soundness against the project's taste rules, including a pre-commit pass, an explicit "sound review", or a request to prune or audit tests.
---

# sound:review

## What to read

- **No argument** → `git diff --cached`.
- **A range** (e.g. `main..HEAD`) → its commits and the whole `git diff <range>`.
- **A test suite** (a test directory, a glob, or "the tests") → every test in it. There is no diff: skip mechanical hits.

## Mechanical hits first

Run `node ../../lint/cli.mjs hits <repo>` (add `--range <range>` for a range). Each line is a check-backed rule's `Detect:` already run by the repo's linter on the changed files. Report these first as `- <file>:<line>: <rule> — <message>`, without re-deriving them by eye; a hit stands until the rule's `Not-when:` is shown to apply, and a check reports only a part of its `Detect:`, so the rule's remainder is still read below. No `.claude/sound/plugin.mjs` → no hits; continue.

## How to review

The project's taste rules live under `.claude/sound/`. Read the ones that bear on the code the diff touches, and apply each rule's `Detect:` and `Not-when:` **verbatim** — never from memory. If `.claude/sound/` is absent, say so and stop.

Review deeply: surface every rule the changes violate, and the enhancements that genuinely matter for this diff's kind. Ground every finding in the diff and the intent behind it — never rule from the text alone. Stay silent where a rule's `Not-when:` applies.

When the diff fixes a fault, search the repo for every other site of the same fault — the same call, pattern or missing guard — and report each one the diff leaves as it was: `- <file>:<line>: same fault as <fixed file>:<line>`.

For a test suite, apply every rule under `.claude/sound/tests/` to each test and give it one verdict: keep, rewrite or delete. No rules there → say so and stop. A test that guards no behavior is deleted; one that guards a behavior through the wrong handle is rewritten.

Report most-consequential first: `- <file>: <rule or enhancement> — <anchor>`; for a suite, `- <file>: <test name>: rewrite | delete — <rule>`, then the count kept. If nothing stands, say `CLEAN`.
