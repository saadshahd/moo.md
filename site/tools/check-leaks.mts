// Every skill page's pair, both panes as the page can draw them (prompts,
// tool lines, activity, dialogs, replies, toasts, menus), must name no
// machine path and no sandbox: a take with a hit is refused, and its recorder
// records again.
// Usage: check-leaks.mts
import { userInfo } from "node:os";
import * as S from "../src/demo/scenes.ts";
import type { Pair } from "../src/demo/types.ts";

// The Door's rule: the user's name, a home path not written as ~/, and the
// recording rig's folders are refused. A take's own
// project path under /Users/Shared/ names no one, nor does a /tmp/ inside
// another folder ("/data/tmp/"), the scene's own disk, nor a scratch file
// right in /tmp ("/tmp/logids", chain's moo-off take): a copy of a world sits
// in a folder there.
const user = userInfo().username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const BANNED = [
  /\/private\/tmp/, /(?<![\w.-])\/tmp\/[^\s"'\/]*\//, /\/Users\/(?!Shared\/)/, /\/home\//, new RegExp(user, "i"),
  /moo-rec/, /\brec[56]\//, /sandbox/i, /EPERM/,
];
let bad = 0;
for (const [name, pair] of Object.entries(S) as [string, Pair][]) {
  if (!pair.off.turns.length) continue;
  const text = JSON.stringify([pair.off.turns, pair.on.turns]);
  const hits = BANNED.flatMap((re) => [...text.matchAll(new RegExp(re.source, re.flags + "g"))].map((m) => text.slice(Math.max(0, m.index! - 40), m.index! + 40)));
  if (hits.length) {
    bad++;
    console.log(`${name}: ${hits.length} hits`);
    hits.slice(0, 4).forEach((h) => console.log(`   …${h}…`));
  }
}
console.log(bad ? `LEAK in ${bad} takes` : "no paths or sandbox in any skill take");
process.exit(bad ? 1 : 0);
