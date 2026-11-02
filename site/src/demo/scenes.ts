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
// - Status line: cut to context use at the left and the output style, as
//   "◎ hold:Plain", at the right, where Claude Code drew it; the weekly use
//   and the model between them are left out (render.ts statusRow()).
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
import type { Chrome, Scene, Turn } from "./types";
import * as freeze from "./sessions/freeze";
import * as anchor from "./sessions/anchor";
import * as skills from "./sessions/skills";
import * as chain from "./sessions/chain";
import * as clarify from "./sessions/clarify";
import * as router from "./sessions/router";
import * as reframe from "./sessions/reframe";
import * as judge from "./sessions/judge";
import * as deepen from "./sessions/deepen";
import * as widen from "./sessions/widen";
import * as interrogate from "./sessions/interrogate";
import * as shift from "./sessions/shift";
import * as elicit from "./sessions/elicit";
import * as explain from "./sessions/explain";
import * as shape from "./sessions/shape";
import * as intent from "./sessions/intent";
import * as inversion from "./sessions/inversion";
import * as draft from "./sessions/draft";
import * as reduce from "./sessions/reduce";

// ---- Skill pages: one session each, turn 0 with all of moo off, turn 1 the
// skill with moo on. The page opens where turn 1 first waits on the user, a
// step from turn 0's reply. Captions are empty until a writer drafts them: one
// beat as each turn starts and one as its reply arrives.

const skill = ({ chrome, turns }: { chrome: Chrome; turns: Turn[] }): Scene => ({
  chrome,
  turns,
  beats: turns.flatMap((_, at): Scene["beats"] => [{ at, text: "" }, { at, on: "reply", text: "" }]),
  plain: 0,
});

export const clarifyScene = skill(clarify);
export const routerScene = skill(router);
export const reframeScene = skill(reframe);
export const judgeScene = skill(judge);
export const deepenScene = skill(deepen);
export const widenScene = skill(widen);
export const anchorScene = skill(anchor);
export const interrogateScene = skill(interrogate);
export const shiftScene = skill(shift);
export const elicitScene = skill(elicit);
export const explainScene = skill(explain);
export const shapeScene = skill(shape);
export const intentScene = skill(intent);
export const inversionScene = skill(inversion);
export const freezeScene = skill(freeze);
export const draftScene = skill(draft);
export const reduceScene = skill(reduce);

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
