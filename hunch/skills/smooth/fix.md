# Smooth: one fix for what slowed the agent down

The agents that worked in this project yesterday kept hitting the friction below: counted from their session transcripts, across more than one session. Make the one change to the project that stops the next agent hitting it.

1. Read the calls below. To see what led up to one, read its transcript: `<config>/projects/*/<session id>.jsonl`, near its time. Find the cause in the project: the fact, step or command the agents lacked.
2. Put the fix where the cause belongs:
   - a step sequence repeats → a project skill, `_claude/skills/<name>/SKILL.md`. A skill for it exists → change that skill; never add a second.
   - a skill ran and the agent then failed → that skill.
   - every session needs a fact → the project's `CLAUDE.md`.
   - some sessions need a fact → a memory note in the memory folder named below, plus one line in its `MEMORY.md`. A fact `CLAUDE.md` or a note already states is no fix.
   - a command keeps failing → a script in the repo, named in `CLAUDE.md`.
3. Make the smallest change that removes the cause. Match the file's own style.

The cause sits outside this project (a plugin, a tool, the machine) → change nothing.

Files under `.claude/` are copied to `_claude/`: read and write them there.

Your reply is one line and nothing else, under 70 characters: what the next agent will now do differently, and the file. With no change made: `none: ` and where the cause sits.
