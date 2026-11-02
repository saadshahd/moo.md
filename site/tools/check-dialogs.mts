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
const takes: [string, Scene, string][] = [
  ["skills", S.skillsScene, "rec2/skills"],
  ["chain", S.chainScene, "rec2/chain"],
  ["clarify", S.clarifyScene, "rec5/clarify"],
  ["draft", S.draftScene, "rec5/draft"],
  ["intent", S.intentScene, "rec5/intent"],
  ["shape", S.shapeScene, "rec5/shape2"],
  ["interrogate", S.interrogateScene, "rec5/interrogate"],
  ["deepen", S.deepenScene, "rec5/deepen"],
  ["router", S.routerScene, "rec5/router"],
  ["target", S.targetScene, "rec5/target"],
  ["compose", S.composeScene, "rec5/compose"],
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
for (const [name, scene, dir] of takes) {
  const { timing } = phases(scene);
  // Every question of the take in order; captures number them from 1.
  const qs = timing.flatMap((p, i) =>
    p.dialogs.flatMap((d, j) => scene.turns[i].dialogs![j].questions.map((_, q) => ({ i, j, q, d }))),
  );
  for (const f of readdirSync(`${R}/${dir}/dialogs`).filter((f) => !f.includes("80x50")).sort()) {
    // q<n>-o<k>, q<n>-notes, q<n><m>-review (the review of the dialog asking n to m), review;
    // p<n>… and p-review the same for the plain turn, whose questions p counts
    // apart: q then counts the rest.
    const m = /^(?:([pq])(\d*)-)?(o(\d+)|notes|review)-(\d+)x\d+\.ansi$/.exec(f);
    if (!m) throw new Error(`${dir}/dialogs/${f}: a capture this check cannot place`);
    const split = scene.plain !== undefined && readdirSync(`${R}/${dir}/dialogs`).some((x) => x.startsWith("p"));
    const list = !split ? qs : qs.filter((x) => (x.i === scene.plain) === (m[1] === "p"));
    const run = m[2];
    const at = list[(run ? (m[3] === "review" ? firstOf(run) : +run) : list.length) - 1];
    const asked = scene.turns[at.i].dialogs![at.j].questions.length;
    const moments = at.d.script.moments;
    const mo =
      m[3] === "review"
        ? moments.find((x) => x.q === asked)
        : m[3] === "notes"
          ? moments.findLast((x) => x.q === at.q && x.noting)
          : moments.find((x) => x.q === at.q);
    if (!mo) throw new Error(`${dir}/dialogs/${f}: the demo never shows that moment`);
    // The recorded terminal's rows for the dialog, plus those the site keeps above it for keycaps.
    const ours = frame(scene, at.d.open + mo.at + 0.01, +m[5], m[4] ? +m[4] - 1 : undefined, ROWS + KEYCAPS).bottom.map(text);
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
