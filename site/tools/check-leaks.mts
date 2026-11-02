// Every skill page's take, as the page can draw it (prompts, tool lines,
// activity, dialogs, replies, toasts, menus), must name no machine path and
// no sandbox: a take with a hit is refused, and its recorder records again.
// Usage: check-leaks.mts
import { userInfo } from "node:os";
import * as S from "../src/demo/scenes.ts";
import type { Scene } from "../src/demo/types.ts";

// The Door's rule: the user's name, a home path not written as ~/, and the
// recording rig's folders are refused. A take's own project path under
// /Users/Shared/ names no one, nor does a /tmp/ inside another folder
// ("/data/tmp/"), the scene's own disk.
const user = userInfo().username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const BANNED = [
  /\/private\/tmp/, /(?<![\w.-])\/tmp\//, /\/Users\/(?!Shared\/)/, /\/home\//, new RegExp(user, "i"),
  /moo-rec/, /\brec[56]\//, /sandbox/i, /EPERM/,
];
let bad = 0;
for (const [name, scene] of Object.entries(S) as [string, Scene][]) {
  if (scene?.plain === undefined) continue;
  const text = JSON.stringify(scene.turns);
  const hits = BANNED.flatMap((re) => [...text.matchAll(new RegExp(re.source, re.flags + "g"))].map((m) => text.slice(Math.max(0, m.index! - 40), m.index! + 40)));
  if (hits.length) {
    bad++;
    console.log(`${name}: ${hits.length} hits`);
    hits.slice(0, 4).forEach((h) => console.log(`   …${h}…`));
  }
}
console.log(bad ? `LEAK in ${bad} takes` : "no paths or sandbox in any skill take");
process.exit(bad ? 1 : 0);
