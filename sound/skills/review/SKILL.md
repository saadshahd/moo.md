---
name: review
description: Use when reviewing a staged diff or a commit range for soundness against the project's taste rules, or sweeping a path's tests or comments against them, including a pre-commit pass, an explicit "sound review", or a request to prune or audit tests or comments.
---

# sound:review

## What to read

- **No argument** → `git diff --cached`.
- **A range** (e.g. `main..HEAD`) → its commits and the whole `git diff <range>`.
- **A sweep** (the tests or the comments, in a path, a glob or the whole repo) → every test or every comment in it. There is no diff: skip mechanical hits.

## Mechanical hits first

Run `node ../../lint/cli.mjs hits <repo>` (add `--range <range>` for a range). Each line is a check-backed rule's `Detect:` already run by the repo's linter on the changed files. Report these first as `- <file>:<line>: <rule> — <message>`, without re-deriving them by eye; a hit stands until the rule's `Not-when:` is shown to apply, and a check reports only a part of its `Detect:`, so the rule's remainder is still read below. No `.claude/sound/plugin.mjs` → no hits; continue.

## How to review

The project's taste rules live under `.claude/sound/`. Read the ones that bear on the code the diff touches, and apply each rule's `Detect:` and `Not-when:` **verbatim** — never from memory. If `.claude/sound/` is absent, say so and stop.

A rule whose `Detect:` reads cognitive complexity reads it from `cccc --format json <file>`.

Review deeply: surface every rule the changes violate, and the enhancements that genuinely matter for this diff's kind. Ground every finding in the diff and the intent behind it — never rule from the text alone. Stay silent where a rule's `Not-when:` applies.

When the diff fixes a fault, search the repo for every other site of the same fault — the same call, pattern or missing guard — and report each one the diff leaves as it was: `- <file>:<line>: same fault as <fixed file>:<line>`.

For a sweep, give each item one verdict from the rules that govern it. None of those rules installed → say so and stop.

| Sweep | Rules | Verdicts |
|---|---|---|
| tests | every rule under `.claude/sound/tests/` | keep, rewrite, delete |
| comments | `.claude/sound/naming/comment-must-name-a-consequence.md`, and `.claude/sound/naming/block-comment-only.md` where installed | keep, rewrite, delete, encode, fix the code |

A test that guards no behavior is deleted; one that guards a behavior through the wrong handle is rewritten. A comment item is one run of adjacent comment lines, or one trailing comment. A comment that is right but names no consequence is rewritten. A comment whose claim a type, check, test or lint rule can carry is encoded, then deleted, naming the type, check or test that carries it, existing or not; an excuse comment gets `fix the code`, naming the code and its fix.

Report most-consequential first: `- <file>: <rule or enhancement> — <anchor>`; for a sweep, `- <file>: <test name or line>: <verdict> — <rule>`, then the count kept, and for comments the lines a deletion removes. If nothing stands, say `CLEAN`.
