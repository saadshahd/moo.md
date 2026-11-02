// Every skill page's take, as the page can draw it (prompts, tool lines,
// activity, dialogs, replies, toasts, menus), must name no machine path and
// no sandbox: a take with a hit is refused, and its recorder records again.
// Usage: check-leaks.mts
import * as S from "../src/demo/scenes.ts";
import type { Scene } from "../src/demo/types.ts";

const BANNED = [/\/private\/tmp/, /\/tmp\//, /\/Users\//, /\/home\//, /~\//, /sandbox/i, /EPERM/];
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
