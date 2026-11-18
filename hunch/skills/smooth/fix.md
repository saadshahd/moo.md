# Smooth: one fix for what slowed the agent down

The agents that worked in this project kept hitting the friction below, counted across more than one session, reverted commit or reviewed pull request: from their session transcripts, the commits the person reverted, and the person's review comments. Make the one change to the project that stops the next agent hitting it.

1. Read the calls below. A session's transcript is `<config>/projects/*/<session id>.jsonl`: read it near a call's time to see what led up to it. A commit or a review comment carries what it changed or said. Grep the project for comments that explain a workaround near the cause. Find the cause in the project: the fact, step or command the agents lacked, or the mistake they repeat.
2. Fix it at the highest level that works:
   1. The project's code or layout: one supported way, with the wrong way gone. A command keeps failing → a script in the repo, named in `CLAUDE.md`.
   2. A type, lint or test whose failure names the fix, in the shape of a check the project already has.
   3. A step sequence repeats → a project skill, `_claude/skills/<name>/SKILL.md`. A skill for it exists → change that skill; never add a second. A skill ran and the agent then failed → that skill.
   4. Every session needs a fact → the project's `CLAUDE.md`. Some sessions need it → a memory note in the memory folder named below, plus one line in its `MEMORY.md`.

   The project already states the fact or rule and agents still miss it → rewording it is no fix: enforce it a level above where it is written.
3. Make the smallest change that removes the cause. Match the file's own style.

The cause sits outside this project (a plugin, a tool, the machine) → change nothing.

Files under `.claude/` are copied to `_claude/`: read and write them there.

Your reply ends with two lines and nothing after them: `why: ` and why each level above your fix would not work, then, under 70 characters, what the next agent will now do differently, and the file. With no change made, it ends with one line: `none: ` and where the cause sits.
