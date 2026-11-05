// Each dialog capture of a take (question n with the cursor on option k, its
// notes typed, or its review screen, at 45, 80 and 120 columns) against the
// demo's rows below the transcript at that moment, text only.
// Usage: check-dialogs.mts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { same, stripAt, unstrip } from "./strip.mts";
import { homedir } from "node:os";
import * as S from "../src/demo/scenes.ts";
import { frame, phases, KEYCAPS, ROWS } from "../src/demo/render.ts";
import type { Row, Seg } from "../src/demo/render.ts";
import type { Scene } from "../src/demo/types.ts";

const R = `${homedir()}/moo-rec-tools`;
// Each pane with dialogs, its take's capture folder, and the letter its
// captures go by there: q, or p for compose's moo-off turn, captured in a
// take whose later turns ran with moo on (their q captures play no more).
const panes: [string, Scene, string, "p" | "q"][] = [
  ["compose off", S.composeScene.off, "rec5/compose", "p"],
  ["skills off", S.skillsScene.off, "rec7/skills-off", "q"],
  ["skills on", S.skillsScene.on, "rec2/skills", "q"],
  ["chain on", S.chainScene.on, "rec2/chain", "q"],
  ["anchor off", S.anchorScene.off, "rec7/anchor-off", "q"],
  ...(["clarify", "compose", "deepen", "draft", "elicit", "intent", "interrogate", "shape"] as const).map(
    (page): [string, Scene, string, "q"] => [`${page} on`, S[`${page}Scene`].on, `rec7/${page}-on`, "q"],
  ),
];
const text = (r: Row) => r.segs.map((s: Seg) => s[0]).join("").replace(/\xa0/g, " ").trimEnd();
let total = 0;
/** The first question of a review's name, which runs its questions' numbers
 * together: "3456" is 3 to 6, "111213" is 11 to 13. */
const firstOf = (run: string) => {
  for (let n = 1; n <= +run; n++) {
    let s = "";
    for (let k = n; s.length < run.length; k++) s += k;
    if (s === run) return n;
  }
  throw new Error(`a review named for no run of questions: q${run}`);
};
let bad = 0;
for (const [name, scene, dir, letter] of panes) {
  // Every question the pane asks, in order; captures number them from 1.
  const qs = phases(scene).timing.flatMap((p, i) =>
    p.dialogs.flatMap((d, j) => scene.turns[i].dialogs![j].questions.map((_, q) => ({ scene, i, j, q, d }))),
  );
  for (const f of readdirSync(`${R}/${dir}/dialogs`).filter((f) => !f.includes("80x50")).sort()) {
    // q<n>-o<k>, q<n>-notes, q<n><m>-review (the review of the dialog asking n to m), review
    // or submit (the review of the last dialog);
    // p<n>… and p-review the same for a moo-off turn whose take went on with moo on.
    const m = /^(?:([pq])(\d*)-)?(o(\d+)|notes|review|submit)-(\d+)x\d+\.ansi$/.exec(f);
    if (!m) throw new Error(`${dir}/dialogs/${f}: a capture this check cannot place`);
    if ((m[1] ?? "q") !== letter) continue;
    const list = qs;
    const run = m[2];
    const at = list[(run ? (m[3] === "review" ? firstOf(run) : +run) : list.length) - 1];
    const asked = at.scene.turns[at.i].dialogs![at.j].questions.length;
    const moments = at.d.script.moments;
    const mo =
      m[3] === "review" || m[3] === "submit"
        ? moments.find((x) => x.q === asked)
        : m[3] === "notes"
          ? moments.findLast((x) => x.q === at.q && x.noting)
          : moments.find((x) => x.q === at.q);
    if (!mo) throw new Error(`${dir}/dialogs/${f}: the demo never shows that moment`);
    // The recorded terminal's rows for the dialog, plus those the site keeps above it for keycaps.
    const ours = frame(at.scene, at.d.open + mo.at + 0.01, +m[5], m[4] ? +m[4] - 1 : undefined, ROWS + KEYCAPS).bottom.map(text);
    const cap = readFileSync(`${R}/${dir}/dialogs/${f}`, "utf8")
      .split("\n")
      .map((l) => l.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "").replace(/\xa0/g, " ").trimEnd());
    while (cap.length && !cap[cap.length - 1]) cap.pop();
    // The view-link strip, at the column the tall capture of that width shows.
    const tall = `${R}/${dir}/tall-${m[5]}.ansi`;
    const strip = existsSync(tall) ? stripAt(readFileSync(tall, "utf8").split("\n").map((l) => l.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "").trimEnd()), +m[5]) : undefined;
    const tail = unstrip(cap, +m[5], strip).slice(-ours.length);
    const diffs = ours.flatMap((o, k) => (same(o, tail[k] ?? "") ? [] : [k]));
    total++;
    if (!diffs.length) continue;
    bad++;
    console.log(`${name} ${f}: DIFF ${diffs.length} of ${ours.length} rows`);
    for (const k of diffs.slice(0, 2)) console.log(`   row ${k}\n     ours: ${JSON.stringify(ours[k])}\n     rec : ${JSON.stringify(tail[k])}`);
  }
}
console.log(bad ? `DIFF ${bad} of ${total} captures` : `ok ${total} captures`);
process.exit(bad ? 1 : 0);
