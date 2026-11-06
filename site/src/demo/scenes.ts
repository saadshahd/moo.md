// What each page's demo plays: a pair, the same words with moo off and on.
//
// Changed from the recordings, as the user asked:
// - Renamed (tools/gen.py renamed()):
//   - A take recorded in a copy of its world names the world: its path, its
//     project folder under ~/.claude/projects and its bare folder name, each
//     as long as the copy's, so text wraps where it did.
//     | Pages        | Copy                      | World                   |
//     | clarify (off)| /Users/Shared/rela2       | /Users/Shared/relay     |
//     | clarify (on) | /Users/Shared/rela3       | /Users/Shared/relay     |
//     | widen        | /Users/Shared/motionpa1   | /Users/Shared/motionpad |
//     | intent       | /Users/Shared/harnes1     | /Users/Shared/harness   |
//     | judge (off)  | /Users/Shared/chimebo1    | /Users/Shared/chimebox  |
//     | judge (on)   | /Users/Shared/chimebo2    | /Users/Shared/chimebox  |
//     | reframe      | /Users/Shared/shopdec1    | /Users/Shared/shopdeck  |
//     | shift        | /Users/Shared/agent-ki1   | /Users/Shared/agent-kit |
//     | shape        | /Users/Shared/glossary3   | /Users/Shared/glossary2 |
//     | compose      | /Users/Shared/agentdes1   | /Users/Shared/agentdesk |
//     | consult      | /Users/Shared/invoicin2   | /Users/Shared/invoicing |
//     | elicit       | /Users/Shared/taskdes2    | /Users/Shared/taskdesk  |
//     | explain      | /Users/Shared/songboo2    | /Users/Shared/songbook  |
//     | interrogate  | /Users/Shared/callgat1    | /Users/Shared/callgate  |
//     | deepen       | /Users/Shared/mdchec1     | /Users/Shared/mdcheck   |
//     | anchor (off) | /Users/Shared/billin3     | /Users/Shared/billing   |
//     | anchor (on)  | /Users/Shared/billin4     | /Users/Shared/billing   |
//     | reduce       | /Users/Shared/catalo1     | /Users/Shared/catalog   |
//     | target       | /Users/Shared/termsyn1    | /Users/Shared/termsync  |
//     | router       | /Users/Shared/tasklin1    | /Users/Shared/taskline  |
//     | freeze       | /private/tmp/order1       | /private/tmp/orders     |
//     | draft        | /private/tmp/shi1         | /private/tmp/ship       |
//     | inversion    | /private/tmp/notes-bo1    | /private/tmp/notes-box  |
//     | chain (off)  | /Users/Shared/t00/shop    | ~/shop                  |
//     | skills (off) | /Users/Shared/t01/invoices | ~/invoices             |
//   - Then every home path, so no home path and no username shows: the dev
//     repo's hope, ~/repos/moo.md/hope/, as the installed plugin,
//     ~/.claude/plugins/cache/moo-md/hope/ (the same length); any other path
//     under the home folder as ~/…, shorter than recorded; and a project
//     folder's name under ~/.claude/projects as -Users-dev-….
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
//   lint errors"", and the spinner's words after its counter, as "running
//   PostToolUse hook" and "thinking with xhigh effort"; the spinner keeps its
//   verb, time and tokens (tools/gen.py chrome_of()).
// - Removed: hold's "[ view ]" buttons under a tool summary, and the strip
//   Claude Code drew down the right edge where they did not fit their row.
//   hold now draws them for pictures only, and no take touched a picture
//   (tools/gen.py).
// - Removed from each dialog: its key hints, as "Enter to select · ↑/↓ to
//   navigate · Esc to cancel", the "Chat about this" row and the rule above
//   it, and "Notes: press n to add notes"; notes typed still show. No take
//   moved the cursor to "Chat about this" (render.ts dialogRows()).
// - Removed while a dialog is open: the activity line over it, which repeats
//   the dialog's first question (render.ts transcriptAt()).
// - A question with previews, where its box would fall under 44 columns (45),
//   stacks: its options at full width, the preview's box under them, then
//   any notes typed. Claude Code squeezes both sides there, so the options'
//   numbers break and the box shows the preview as 7-column fragments
//   (render.ts previewRows()).
// - The tool line under an activity line keeps one row: its first line, cut
//   with "…" where it runs past the row. Claude Code drew up to 300
//   characters of it, a heredoc's every line (render.ts activityRows()).
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
import type { Chrome, Pair, Turn } from "./types";
import * as clarifyOff from "./sessions/clarify-off";
import * as clarifyOn from "./sessions/clarify-on";
import * as consultOff from "./sessions/consult-off";
import * as consultOn from "./sessions/consult-on";
import * as composeOff from "./sessions/compose-off";
import * as composeOn from "./sessions/compose-on";
import * as targetOff from "./sessions/target-off";
import * as targetOn from "./sessions/target-on";
import * as routerOff from "./sessions/router-off";
import * as routerOn from "./sessions/router-on";
import * as reframeOff from "./sessions/reframe-off";
import * as reframeOn from "./sessions/reframe-on";
import * as judgeOff from "./sessions/judge-off";
import * as judgeOn from "./sessions/judge-on";
import * as deepenOff from "./sessions/deepen-off";
import * as deepenOn from "./sessions/deepen-on";
import * as widenOff from "./sessions/widen-off";
import * as widenOn from "./sessions/widen-on";
import * as anchorOff from "./sessions/anchor-off";
import * as anchorOn from "./sessions/anchor-on";
import * as interrogateOff from "./sessions/interrogate-off";
import * as interrogateOn from "./sessions/interrogate-on";
import * as shiftOff from "./sessions/shift-off";
import * as shiftOn from "./sessions/shift-on";
import * as elicitOff from "./sessions/elicit-off";
import * as elicitOn from "./sessions/elicit-on";
import * as explainOff from "./sessions/explain-off";
import * as explainOn from "./sessions/explain-on";
import * as shapeOff from "./sessions/shape-off";
import * as shapeOn from "./sessions/shape-on";
import * as intentOff from "./sessions/intent-off";
import * as intentOn from "./sessions/intent-on";
import * as inversionOff from "./sessions/inversion-off";
import * as inversionOn from "./sessions/inversion-on";
import * as freezeOff from "./sessions/freeze-off";
import * as freezeOn from "./sessions/freeze-on";
import * as draftOff from "./sessions/draft-off";
import * as draftOn from "./sessions/draft-on";
import * as reduceOff from "./sessions/reduce-off";
import * as reduceOn from "./sessions/reduce-on";
import * as chainOff from "./sessions/chain-off";
import * as chainOn from "./sessions/chain-on";
import * as skillsOff from "./sessions/skills-off";
import * as skillsOn from "./sessions/skills-on";

// Each page: the same words typed with all of moo off, then with moo on, each
// in a fresh copy of the same world. A skill page's moo-off pane plays the
// first turn of an earlier take, whose later turns ran with moo on; judge's
// and the chain pages' moo-off panes are takes of their own. The chain pages'
// moo-on panes are their earlier takes, all of moo on.
const pair = (off: { chrome: Chrome; turns: Turn[] }, on: { chrome: Chrome; turns: Turn[] }): Pair => ({
  off: { chrome: off.chrome, turns: off.turns },
  on: { chrome: on.chrome, turns: on.turns },
});

export const clarifyScene = pair(clarifyOff, clarifyOn);
export const consultScene = pair(consultOff, consultOn);
export const composeScene = pair(composeOff, composeOn);
export const targetScene = pair(targetOff, targetOn);
export const routerScene = pair(routerOff, routerOn);
export const reframeScene = pair(reframeOff, reframeOn);
export const judgeScene = pair(judgeOff, judgeOn);
export const deepenScene = pair(deepenOff, deepenOn);
export const widenScene = pair(widenOff, widenOn);
export const anchorScene = pair(anchorOff, anchorOn);
export const interrogateScene = pair(interrogateOff, interrogateOn);
export const shiftScene = pair(shiftOff, shiftOn);
export const elicitScene = pair(elicitOff, elicitOn);
export const explainScene = pair(explainOff, explainOn);
export const shapeScene = pair(shapeOff, shapeOn);
export const intentScene = pair(intentOff, intentOn);
export const inversionScene = pair(inversionOff, inversionOn);
export const freezeScene = pair(freezeOff, freezeOn);
export const draftScene = pair(draftOff, draftOn);
export const reduceScene = pair(reduceOff, reduceOn);
export const chainScene = pair(chainOff, chainOn);
export const skillsScene = pair(skillsOff, skillsOn);
