---
name: smooth
description: Count what slowed the agents down in this project over the last day, and leave one fix for the friction that recurred most, on a smooth/<date> branch you keep or drop. Run it nightly from a scheduled task. Costs one Sonnet call on a day with a fix, none otherwise.
disable-model-invocation: true
---

Run `${CLAUDE_SKILL_DIR}/scripts/smooth.sh` from the project root, in the foreground: a scheduled run may end before a background job does. It fails → show its error and stop.

When it ends, show its output as it printed it.
