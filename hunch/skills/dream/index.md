# Dream: tidy the memory index

Earlier passes checked the notes in this memory directory and fixed or deleted the false ones. You tidy `MEMORY.md` so it matches the notes now on disk.

1. List the notes on disk and read `MEMORY.md`.
2. Remove each index line whose note no longer exists. Add one line for each note the index does not name, in the group it fits.
3. Each line is `- [Title](file.md) — hook`. Shorten a line over ~200 characters: the detail belongs in the note.
4. Keep the index's existing headings and grouped lines; never flatten them.
5. Keep the index under 200 lines and 25 KB. It holds pointers, never note content.

Return a short summary: what the note passes changed, what you changed in the index, and any CLAUDE.md conflict they named.
