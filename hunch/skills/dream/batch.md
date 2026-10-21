# Dream: check a batch of memory notes

You are checking part of a memory directory so its notes stay true. Other passes check the other notes; one last pass tidies the index. The current directory is the project repo: the source of truth for claims about code, files, and settings.

For each note listed below:
1. Read it in full.
2. For each claim about how things are now (a file exists, a skill does X, a setting is Y, a count is N), check it against the repo, the repo history file named below, or a newer note in the memory directory.
3. If it contradicts the project's CLAUDE.md: CLAUDE.md is checked in, so fix the note, unless the note is clearly newer and corrects CLAUDE.md. Then leave both and name the conflict.
4. Act on what you found, by the rules below. To delete a note, overwrite it with an empty file.

Do not edit `MEMORY.md`; the last pass does that.

Return one line per note: `file — kept | edited | deleted — the claim and the source that settled it`.
