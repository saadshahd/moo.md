// What each page's demo plays: the turns of one recorded session and the beats
// that mark its moments.
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
// - tend's band above the prompt box, "[-]" and its chips, as
//   "[ questions 2 ]", shows where recorded (tools/gen.py chrome_of()). No
//   recording opens its pane: a chip's click or Enter opens it, laid out by
//   tend's own code from the session's text (tools/card.mts), in a frame
//   drawn as the toast's box, its last lines cut to "…" where the terminal
//   lacks the rows; it pauses the demo, and a second click, its close, Esc,
//   play or a seek closes it (render.ts paneRows(), player.ts).
// - Option gaps: half a row of space under each option's description and above
//   "Type something." (Demo.astro's .gap; render.ts's fit() counts it). Claude
//   Code draws none.
import type { Chrome, Scene, Turn } from "./types";
import * as freeze from "./sessions/freeze";
import * as anchor from "./sessions/anchor";
import * as skills from "./sessions/skills";
import * as chain from "./sessions/chain";
import * as clarify from "./sessions/clarify";
import * as consult from "./sessions/consult";
import * as compose from "./sessions/compose";
import * as target from "./sessions/target";
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
// skill with moo on. The page plays both, turn 0 first. Each turn has two
// beats: as it starts and as its reply arrives.

const skill = ({ chrome, turns }: { chrome: Chrome; turns: Turn[] }): Scene => ({
  chrome,
  turns,
  beats: turns.flatMap((_, at): Scene["beats"] => [{ at }, { at, on: "reply" }]),
  plain: 0,
});

export const clarifyScene = skill(clarify);
export const consultScene = skill(consult);
export const composeScene = skill(compose);
export const targetScene = skill(target);
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
    { at: 0 },
    { at: 0, on: "move", n: 0 },
    { at: 0, on: "move", n: 1 },
    { at: 0, on: "dialog", q: 0 },
    { at: 0, on: "move", n: 2 },
    { at: 0, on: "move", n: 3 },
    { at: 0, on: "reply" },
  ],
};

export const skillsScene: Scene = {
  chrome: skills.chrome,
  turns: skills.turns,
  beats: [
    { at: 0 },
    { at: 0, on: "move", n: 0 },
    { at: 0, on: "move", n: 1 },
    { at: 0, on: "dialog", d: 0, q: 0 },
    { at: 0, on: "dialog", d: 1, q: 0 },
    { at: 0, on: "move", n: 2 },
    { at: 0, on: "dialog", d: 2, q: 0 },
    { at: 0, on: "reply" },
    { at: 1 },
    { at: 1, on: "reply" },
  ],
};
