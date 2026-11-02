// What each page's demo plays: the turns of one recorded session and the beats
// that narrate it.
//
// Changed from the recordings, as the user asked:
// - Renamed: each path under the home folder is written ~/…, and a project
//   folder under ~/.claude/projects is named for a user called dev, so no
//   username shows (tools/gen.py renamed()).
// - Removed from the welcome banner: the blank row above it, the two under it,
//   the model row ("Opus 5.5 with xhigh effort · Claude Ultra") and the folder
//   row (as "~/orders"). What is left, "Claude Code v2.1.316", takes one row,
//   so the logo is drawn that tall (render.ts header()), with half a row of
//   space under it (Demo.astro's .banner).
// - Status line: cut to context use at the left and "◎ hold:Plain" at the
//   right, where Claude Code drew it; the weekly use and the model between
//   them are left out (render.ts statusRow()).
// - Removed: the mode row under the status line, "⏵⏵ bypass permissions on
//   (shift+tab to cycle)". Nothing below it needs its row (render.ts frame()).
// - Removed: Claude Code's notices above the prompt box, "◉ xhigh · /effort"
//   and "Advisor Tool (experimental) is on and may use more tokens · /advisor".
//   Their row stays blank, as Claude Code leaves it with none (tools/gen.py
//   chrome_of()).
// - Removed: Claude Code's dim suggestion in the empty prompt, as "Try "fix
//   lint errors"", and the hook the spinner names, as "running PostToolUse
//   hook"; the spinner keeps its verb and counter (tools/gen.py chrome_of()).
// - Removed: hunch's band above the prompt box, "[-]" and its chips, as
//   "[ questions 2 ]"; the demo can't click it, so its rows go to the
//   transcript (tools/gen.py chrome_of()).
// - Light theme: drawn from Claude Code's colours, darkened for contrast; not
//   a recording (Demo.astro's terminal colours). Dark is as recorded.
// - Option gaps: half a row of space under each option's description and above
//   "Type something." (Demo.astro's .gap; render.ts's fit() counts it). Claude
//   Code draws none.
import type { Scene, Turn } from "./types";
import * as freeze from "./sessions/freeze";
import * as anchor from "./sessions/anchor";
import * as draft from "./sessions/draft";
import * as reduce from "./sessions/reduce";
import * as skills from "./sessions/skills";
import * as chain from "./sessions/chain";

// ---- Move pages: one scene each, the one that carries the move.

export const freezeScene: Scene = {
  chrome: freeze.chrome,
  turns: freeze.turns,
  beats: [
    {
      at: 0,
      text: "The ask: the export that stopped this morning.",
    },
    { at: 0, on: "reply", text: "Three tables: what it saw, couldn't see, inferred." },
    { at: 1, text: "You type lock; five gaps stay open." },
  ],
};

export const anchorScene: Scene = {
  chrome: anchor.chrome,
  turns: anchor.turns,
  // gen.py drops what Claude Code drew under a long command while it ran.
  cut: ["the running time and background hint under long commands"],
  beats: [
    {
      at: 0,
      text: "The finding: an index blocked payment writes for 9 minutes.",
    },
    {
      at: 0,
      on: "dialog",
      q: 0,
      text: "Which tables? Each box shows the migrations it fails.",
    },
    {
      at: 0,
      on: "reply",
      text: "The test caught 0043; the table lists what's still open.",
    },
  ],
};

export const draftScene: Scene = {
  chrome: draft.chrome,
  turns: draft.turns,
  beats: [
    { at: 0, text: "The ask: a blocked deploy that names its check." },
    {
      at: 0,
      on: "dialog",
      q: 0,
      text: "The formatter runs; each box shows what an option prints.",
    },
    {
      at: 0,
      on: "dialog",
      q: 1,
      text: "Not the recommended pick: first line only, with a note.",
    },
    {
      at: 0,
      on: "dialog",
      q: 2,
      text: "Links: each failed check, plus the run.",
    },
    {
      at: 0,
      on: "reply",
      text: "Your picks, tested; below, the calls it made alone.",
    },
  ],
};

/** The turn with `menu` drawn over its prompt box. */
const withMenu = (turn: Turn, menu: Turn["menu"]): Turn => ({ ...turn, menu });
export const reduceScene: Scene = {
  chrome: reduce.chrome,
  // The later /hope:reduce turns: no capture fell between typing "/reduce" and
  // its Enter, so they show the menu the first one drew for the same text.
  turns: reduce.turns.map((turn, i) => (i > 1 ? withMenu(turn, reduce.turns[1].menu) : turn)),
  // render.ts draws a ```markdown block rendered; Claude Code drew it as source.
  cut: ["the PR text's markdown is rendered, where Claude Code showed it as source"],
  beats: [
    { at: 0, text: "A PR description for the reviewer who wrote the cache." },
    { at: 1, text: "The headings go; the cost question stays." },
    {
      at: 2,
      text: "Again: the tail becomes a short list.",
    },
    { at: 3, text: "The third pass trims words, not facts." },
  ],
};

// ---- Chain pages: one session where /compose runs each move as it comes up.

export const chainScene: Scene = {
  chrome: chain.chrome,
  turns: chain.turns,
  beats: [
    {
      at: 0,
      text: "One ask: find the double charge, and keep it from coming back.",
    },
    { at: 0, on: "move", n: 0, text: "Reading prod's logs and the provider's export." },
    {
      at: 0,
      on: "move",
      n: 1,
      text: "The bar comes first; no code yet.",
    },
    {
      at: 0,
      on: "dialog",
      q: 0,
      text: "The provider's site is out of reach, so it asks you.",
    },
    {
      at: 0,
      on: "move",
      n: 2,
      text: "Four files changed so far; the reply sums them up.",
    },
    { at: 0, on: "move", n: 3, text: "Tests rerun: red on the old code, green on the new." },
    {
      at: 0,
      on: "reply",
      text: "The cause first, then seven charges to refund.",
    },
  ],
};

export const skillsScene: Scene = {
  chrome: skills.chrome,
  turns: skills.turns,
  beats: [
    { at: 0, text: "One ask, three skills from other plugins." },
    {
      at: 0,
      on: "move",
      n: 0,
      text: "From mattpocock-skills: the terms come first.",
    },
    {
      at: 0,
      on: "move",
      n: 1,
      text: "From the show-me plugin: each option, sketched.",
    },
    {
      at: 0,
      on: "dialog",
      d: 0,
      q: 0,
      text: "The box: what one invoice owes under each rule.",
    },
    {
      at: 0,
      on: "dialog",
      d: 1,
      q: 0,
      text: "Against the recommendation: the rate lives on each invoice.",
    },
    {
      at: 0,
      on: "move",
      n: 2,
      text: "From mattpocock-skills too: tests before code.",
    },
    {
      at: 0,
      on: "dialog",
      d: 2,
      q: 0,
      text: "Tests see only what an invoice owes.",
    },
    {
      at: 0,
      on: "reply",
      text: "Eight tests pass; the last line asks you.",
    },
    { at: 1, text: "Your answer, in your words." },
    { at: 1, on: "reply", text: "A ninth test now holds your answer." },
  ],
};
