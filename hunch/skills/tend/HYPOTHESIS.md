With `tend` on, what the session settled and what its agents returned sit one click away above the prompt, and what goes back to the model goes in the user's own words.

Graduate when it stays on for 10 real sessions with no part turned off and the user never scrolls back for something the band holds. Kill if he turns it off, or a chip hides something he needed.

## Field notes

### 2026-09-22 — founding, from prototypes A–G

- No hotkeys: the user clicks.
- No reply fold: native focus mode (`/focus`, ctrl+o) already hides; ours duplicated it and re-folded on every turn.
- No hold: dropping a task notification stalls a skill waiting on its agent and leaves a "Prompt dropped by a hook" row no hook can hide.
- Fill, don't submit: a plugin-submitted prompt reaches the model as the plugin's, not the user's.
- No goal card: intent covers it.
- No changed-files chip: Claude Code already shows edits.
- No duplicate-peer drop: no duplicate reproduced; unmeasured.
- Watch never points at agent state (a scratchpad); only where a human looks.
- Solo's terminal draws neither image pixels nor OSC 8 links; `open` covers both.
- Skills: compose's plan becomes a chip, a run skill gets ✓ (seen by `skill.prompt`), and the next unrun one is the Tab suggestion.
- A card keeps each key from the newest block that has it, so clarify's card leaves compose's skills; `[]` clears a list.
- The engine's own prompt guess lands after the plan's next skill and replaced it; a `prompt.suggest` hook now keeps the plan's.
- Arrows: the engine's focus ring treats every arrow as next/previous, and a Button pressed inside a Client keeps keys from it. The band is a Client of plain text: clicks are hit-tested, left/right move along a row, up/down between rows. Keys reach it only after a click.
- Teammates stay `running` in `$.agent.list()`, so they get no row.

### 2026-09-22 — colour, focus, and a design panel (Tufte, Victor, Matuschak, Appleton)

- Colour carries state only, by theme key: the open chip blue, ✓ green, ● yellow; hover marks what takes a click.
- No API hands the keys back to the prompt; after a fill the band redraws under a new key and the keys return.
- Which skills ran and which questions got answers live in `$.store`: a reload wiped them.
- Kept: a chip carries one number (`facts 2`, `skills 1/2`); an agent's pane opens with what it was asked; a fact that settles a choice names what lost; watch says what should appear.
- Cut: agent sparklines and tool traces (Claude Code's agent view shows the work; motion is a push), a replaced spinner word (the engine's), a turn scrubber (a hidden mode), guess-before-read (a gate), a "yours" chip (his words are already his turns), a status-line trail (always on, repeats the skills chip), no border (he chose the border), next-skill-only (he asked for every skill).
- Cut: provenance on hover (lighting the reply a fact came from): it sends him scrolling back, the one thing the graduate bar forbids.
