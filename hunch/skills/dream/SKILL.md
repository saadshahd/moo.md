---
name: dream
description: Check this project's memory notes against the repo, fix the ones that went false, and tidy the index, as one git commit you can revert. Checks only notes that are new or name a changed file; pass `all` to check every note. Costs one Sonnet call per 15 notes, plus one.
disable-model-invocation: true
---

Run `${CLAUDE_SKILL_DIR}/scripts/dream.sh <memory-dir> $ARGUMENTS` from the project root, in the background: it takes minutes. `<memory-dir>` is the auto-memory directory your system prompt names. It fails → show its error and stop.

When it ends, show its output as it printed it: the summary, the commit's changed files, and the undo command.
