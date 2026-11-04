// Usage: check-end.mts <raw turns json> <capture dir>. A take whose tall
// captures show a reply before tend shortened it (tend drops its short form
// when the terminal resizes) is checked here instead: our last rows against
// each end-<w>x36 capture, which Claude Code drew as the take ended.
import { readFileSync } from "node:fs";
import { frame } from "../src/demo/render.ts";
const [json, dir] = process.argv.slice(2);
const scene: any = { chrome: { context: "0%" }, turns: JSON.parse(readFileSync(json, "utf8")), beats: [{ at: 0 }] };
let bad = 0;
for (const w of [45, 80, 120]) {
  const ours = frame(scene, 1e9, w).transcript.map((r: any) => r.segs.map((s: any) => (s[1] === "logo" ? "" : s[0])).join("").replace(/\xa0/g, " ").trimEnd());
  while (ours.length && !ours[ours.length - 1]) ours.pop();
  const cap = readFileSync(`${dir}/end-${w}x36.ansi`, "utf8").split("\n").map((l) => l.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "").replace(/\xa0/g, " ").trimEnd());
  const end = cap.findIndex((l) => /^─{10}/.test(l));
  // The site draws no done line ("✻ Brewed for …"): drop each with the blank after it.
  const body: string[] = [];
  for (let k = 0; k < end; k++) {
    if (!cap[k].startsWith("✻")) { body.push(cap[k]); continue; }
    while (k + 1 < end && cap[k + 1]) k++; // its wrapped rows
    k++; // the blank after it
  }
  while (body.length && !body[body.length - 1]) body.pop();
  while (body.length && !body[0]) body.shift();
  const tail = ours.slice(-body.length);
  const diff = tail.flatMap((o, k) => (o === body[k] ? [] : [k]));
  if (diff.length) bad++;
  console.log(`end ${w}: ${body.length} rows, ${diff.length} differ`, diff.slice(0, 2).map((k) => JSON.stringify([tail[k], body[k]])).join(" "));
}
process.exit(bad ? 1 : 0);
