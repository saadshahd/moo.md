With `tend` on, what the session settled and what its agents returned sit one click away above the prompt, and what goes back to the model goes in the user's own words.

Graduate when it stays on for 10 real sessions with no part turned off and the user never scrolls back for something the band holds. Kill if the user turns it off, or a chip hides something they needed.

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
- Skills: compose's plan becomes a chip, a run skill gets ✓ (seen at its Skill tool call or its slash command), and the next unrun one is the Tab suggestion.
- A card keeps each key from the newest block that has it, so clarify's card leaves compose's skills; `[]` clears a list.
- The engine's own prompt guess lands after the plan's next skill and replaced it; a `prompt.suggest` hook now keeps the plan's.
- Arrows: the engine's focus ring treats every arrow as next/previous, and a Button pressed inside a Client keeps keys from it. The band is a Client of plain text: clicks are hit-tested, left/right move along a row, up/down between rows. Keys reach it only after a click.
- Teammates stay `running` in `$.agent.list()`; their own turn ending marks them done (see below).

### 2026-09-22 — colour, focus, and a design panel (Tufte, Victor, Matuschak, Appleton)

- Colour carries state only, by theme key: the open chip blue, ✓ green, ● yellow; hover marks what takes a click.
- No API hands the keys back to the prompt; after a fill the band redraws under a new key and the keys return.
- Which skills ran and which questions got answers live in `$.store`: a reload wiped them.
- Kept: a chip carries one number (`facts 2`, `skills 1/2`); an agent's pane opens with what it was asked; a fact that settles a choice names what lost; watch says what should appear.
- Cut: agent sparklines and tool traces (Claude Code's agent view shows the work; motion is a push), a replaced spinner word (the engine's), a turn scrubber (a hidden mode), guess-before-read (a gate), a "yours" chip (the user's words are already their turns), a status-line trail (always on, repeats the skills chip), no border (the user chose the border), next-skill-only (the user asked for every skill).
- Cut: provenance on hover (lighting the reply a fact came from): it sends the user scrolling back, the one thing the graduate bar forbids.

### 2026-09-22 — three rounds of simulated users (a first-timer, an expert) on real `/hope:compose` work

In control, 1–7, per round: first-timer 3 → 3 → 4, expert 3 → 4 → 5. Re-reading an agent: first-timer ease 6 → 1 → 5.

- Teammates are the agents compose starts; they stay `running` in `$.agent.list()`, so their own turn ending marks them done.
- Agents live in the pane only: `[ agents N ● ]` opens their list, each one a card (intent, outcome, watch, facts), its full report one click further.
- Every agent is asked to end on a card; facts are what the user carries forward, never paths or tool steps. Places read by name, open by path.
- A card already shown stays current: each prompt of the user's asks the model for the keys that turn changed.
- Keys: typing on the band or pane goes on to the prompt; Enter acts only after the arrows moved, else hands the keys back; a pane reopens without them.
- A card stays in the band's box while it wraps to a few lines at the reading measure (`BOX_LINES`, `MEASURE`); longer, it opens in the pane.
- Source files open in the editor (`code -g`), the rest with `open`.
- Cut: a standing agents row (the user: "agents should exist as a pane only"); the full report inline (card-sized, plain); uppercase and coloured buttons (Norman, Wathan and Jev agreed: brackets are the sign, colour means state).
- The band grows upward: a card opens above its chips, so the chips never move under the pointer (`▴` marks the open one). The transcript can still move above them while a turn streams.
