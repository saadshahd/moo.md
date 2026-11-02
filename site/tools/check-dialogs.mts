// Each dialog capture of a take (question n with the cursor on option k, its
// notes typed, or its review screen, at 45, 80 and 120 columns) against the
// demo's rows below the transcript at that moment, text only.
// Usage: check-dialogs.mts
import { readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import * as S from "../src/demo/scenes.ts";
import { frame, phases, KEYCAPS, ROWS } from "../src/demo/render.ts";
import type { Row, Seg } from "../src/demo/render.ts";
import type { Scene } from "../src/demo/types.ts";

const R = `${homedir()}/moo-rec-tools`;
const takes: [string, Scene, string][] = [
  ["anchor", S.anchorScene, "rec3/anchor"],
  ["skills", S.skillsScene, "rec2/skills"],
  ["chain", S.chainScene, "rec2/chain"],
  ["clarify", S.clarifyScene, "rec5/clarify"],
  ["draft", S.draftScene, "rec5/draft"],
];
const text = (r: Row) => r.segs.map((s: Seg) => s[0]).join("").replace(/\xa0/g, " ").trimEnd();
let total = 0;
let bad = 0;
for (const [name, scene, dir] of takes) {
  const { timing } = phases(scene);
  // Every question of the take in order; captures number them from 1.
  const qs = timing.flatMap((p, i) =>
    p.dialogs.flatMap((d, j) => scene.turns[i].dialogs![j].questions.map((_, q) => ({ i, j, q, d }))),
  );
  for (const f of readdirSync(`${R}/${dir}/dialogs`).filter((f) => !f.includes("80x50")).sort()) {
    // q<n>-o<k>, q<n>-notes, q<n><m>-review (the review of the dialog asking n to m), review.
    const m = /^(?:q(\d+)-)?(o(\d+)|notes|review)-(\d+)x\d+\.ansi$/.exec(f);
    if (!m) throw new Error(`${dir}/dialogs/${f}: a capture this check cannot place`);
    const at = qs[(m[1] ? +m[1][0] : qs.length) - 1];
    const asked = scene.turns[at.i].dialogs![at.j].questions.length;
    const moments = at.d.script.moments;
    const mo =
      m[2] === "review"
        ? moments.find((x) => x.q === asked)
        : m[2] === "notes"
          ? moments.findLast((x) => x.q === at.q && x.noting)
          : moments.find((x) => x.q === at.q);
    if (!mo) throw new Error(`${dir}/dialogs/${f}: the demo never shows that moment`);
    // The recorded terminal's rows for the dialog, plus those the site keeps above it for keycaps.
    const ours = frame(scene, at.d.open + mo.at + 0.01, +m[4], m[3] ? +m[3] - 1 : undefined, ROWS + KEYCAPS).bottom.map(text);
    const cap = readFileSync(`${R}/${dir}/dialogs/${f}`, "utf8")
      .split("\n")
      .map((l) => l.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "").replace(/\xa0/g, " ").trimEnd());
    while (cap.length && !cap[cap.length - 1]) cap.pop();
    const tail = cap.slice(-ours.length);
    const diffs = ours.flatMap((o, k) => (o === tail[k] ? [] : [k]));
    total++;
    if (!diffs.length) continue;
    bad++;
    console.log(`${name} ${f}: DIFF ${diffs.length} of ${ours.length} rows`);
    for (const k of diffs.slice(0, 2)) console.log(`   row ${k}\n     ours: ${JSON.stringify(ours[k])}\n     rec : ${JSON.stringify(tail[k])}`);
  }
}
console.log(bad ? `DIFF ${bad} of ${total} captures` : `ok ${total} captures`);
process.exit(bad ? 1 : 0);
