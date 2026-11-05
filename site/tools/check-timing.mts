// Every pane of every demo the built site plays, held to the idle cap: no
// screen stands still longer than IDLE seconds unless it shows words to read:
// words in rows newly shown, at READ's pace, from the last change of the
// burst that showed them. Frames sampled 30 a second at PANE, the pane the
// clock is timed at; the spinner and the status line are not news, a toast
// is.
// Usage: check-timing.mts <site dist dir>. Run npm run build first: the
// pages' demos come from the build.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { frame, IDLE, PANE, phases, READ, words, type Row } from "../src/demo/render.ts";
import * as S from "../src/demo/scenes.ts";
import type { Pair, Scene } from "../src/demo/types.ts";

const [dist] = process.argv.slice(2);
const FRAME = 1 / 30;
// Changes this close together are one burst: a reply's rows coming in.
const BURST = 0.5;
const readFor = (n: number) => Math.min(READ.ceil, Math.max(READ.floor, (n * 60) / READ.wpm));

const html = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? html(join(dir, e.name)) : e.name.endsWith(".html") ? [join(dir, e.name)] : [],
  );
const unescape = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const pages = html(dist).flatMap((file) =>
  [...readFileSync(file, "utf8").matchAll(/data-demo="([^"]*)"/g)].map((m) => ({
    page: file.slice(dist.length + 1).replace(/(index)?\.html$/, "") || "/",
    pair: JSON.parse(unescape(m[1])) as Pair,
  })),
);
if (!pages.length) throw new Error(`${dist}: no demo pages; run npm run build first`);
// Each page's pair by name, from scenes.ts: "chainScene" plays gen.py's chain.
const named = Object.entries(S) as [string, Pair][];
const pairOf = (p: Pair) => {
  const hit = named.find(([, s]) => JSON.stringify(s) === JSON.stringify(p));
  if (!hit) throw new Error(`a page plays a pair scenes.ts does not export: "${p.on.turns[0].user}"`);
  return { name: hit[0].replace(/Scene$/, ""), pair: hit[1] };
};

const text = (r: Row) => r.segs.map(([c, k]) => (k === "logo" ? "" : c)).join("");
const SPIN = /^[·✢✳✶✻✽] /;
/** What a reader can read at `s`: transcript and bottom rows, the status line
 * and spinner aside, then the toast. */
function shown(scene: Scene, s: number): string[] {
  const f = frame(scene, s, PANE.cols, undefined, PANE.rows);
  return [
    ...[...f.transcript, ...f.bottom.slice(0, -1)].map(text).filter((r) => !SPIN.test(r)),
    ...(f.toast?.rows.map(text) ?? []),
  ];
}
/** The rows of `to` that `from` did not have, as a multiset. */
function fresh(from: string[], to: string[]) {
  const before = [...from];
  return to.filter((r) => {
    const k = before.indexOf(r);
    if (k >= 0) before.splice(k, 1);
    return k < 0;
  });
}

let fail = 0;
const say = (bad: boolean, line: string) => {
  if (bad) fail++;
  console.log(`${bad ? "FAIL" : "ok  "} ${line}`);
};

// Idle time, once per pane of each pair.
const seen = new Set<string>();
for (const [page, name, side, scene] of pages.flatMap(({ page, pair }) => {
  const { name, pair: p } = pairOf(pair);
  return (["off", "on"] as const).map((side) => [page, name, side, p[side]] as const);
})) {
  if (seen.has(`${name} ${side}`) || !scene.turns.length) continue;
  seen.add(`${name} ${side}`);
  const { length } = phases(scene);
  let prev = shown(scene, 0);
  let key = prev.join("\n");
  let changed = 0; // the last change
  let base = prev; // what was on screen before the burst began
  let until = IDLE; // reading allowed until
  let worst = { run: 0, at: 0, over: -Infinity };
  for (let k = 1; k * FRAME <= length + FRAME; k++) {
    const s = Math.min(k * FRAME, length);
    const now = shown(scene, s);
    const next = now.join("\n");
    if (next === key && s < length) continue;
    // A run ends: it may last IDLE, or as long as the words it shows take.
    const run = s - changed;
    const over = run - (Math.max(changed + IDLE, until) - changed);
    if (run > worst.run || over > worst.over) worst = over > worst.over ? { run, at: changed, over } : worst;
    if (s - changed > BURST) base = prev;
    until = Math.max(until, s + readFor(words(fresh(base, now).join(" "))));
    prev = now;
    key = next;
    changed = s;
  }
  // Sampling can see a change up to a frame late at either end of a stand;
  // the 1e-9 absorbs the float sum of the frame times (compose's moo-off
  // dialog stands exactly READ.ceil, measured one frame and 2e-15 over).
  const bad = worst.over > FRAME + 1e-9;
  say(bad, `${`${name} ${side}`.padEnd(16)} ${length.toFixed(1).padStart(6)} s; ${bad ? `stands ${worst.run.toFixed(2)} s at ${worst.at.toFixed(2)} s, ${worst.over.toFixed(2)} s past what it shows to read` : "no idle stand past the cap"} (${page})`);
}

console.log(fail ? `${fail} panes break the idle cap` : "every pane holds the idle cap");
process.exit(fail ? 1 : 0);
