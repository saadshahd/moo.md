// A session's turns, as recorded (gen.py --raw), drawn at <cols> with nothing
// folded, must match the tall capture row for row (text only), from the first
// prompt down, done lines ("✻ … done …") and the prompt box below the last
// reply aside. The one edit: a ```markdown block, which Claude Code drew as
// source, the site draws rendered (render.ts). Where the rows part, the
// capture's rows must come from such a block and, markers gone, hold the same
// words as ours: rewrapped, never reworded.
// Usage: check-screen.mts <turns.json> <tall.ansi> <cols>
import { readFileSync } from "node:fs";
import { frame } from "../src/demo/render.ts";
import type { Row, Seg } from "../src/demo/render.ts";
import type { Scene } from "../src/demo/types.ts";
import { same, unstrip } from "./strip.mts";

const [turns, cap, w] = process.argv.slice(2);
const scene: Scene = {
  chrome: { context: "0%" },
  turns: JSON.parse(readFileSync(turns, "utf8")),
  beats: [{ at: 0 }],
};
const text = (r: Row) => r.segs.map((s: Seg) => (s[1] === "logo" ? "" : s[0])).join("").replace(/\xa0/g, " ").trimEnd();
const ours = frame(scene, 1e9, +w).transcript.map(text);
// Claude Code draws some spaces as no-break spaces (U+00A0); text only, as in check-dialogs.mts.
const screen = unstrip(readFileSync(cap, "utf8").split("\n").map((l) => l.replace(/\x1b\[[0-9;]*m/g, "").replace(/\xa0/g, " ").trimEnd()), +w);
const from = (xs: string[]) => xs.slice(xs.findIndex((l) => l.startsWith("❯ ")));
const end = screen.findLastIndex((l) => /^\S /.test(l) && / · done /.test(l));
const done = (l: string) => /^\S (\S+ for .*· done |.*messages? hidden)/.test(l) || /^  .*(hidden|show\))\s*$/.test(l);
const norm = (xs: string[]) =>
  xs.filter((l) => !done(l)).filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n").trim().split("\n");
const A = norm(from(ours));
const B = norm(from(screen.slice(0, end + 1)));

// The longest common run of rows; what lies between two matched rows is a hunk.
const L = Array.from({ length: A.length + 1 }, () => new Array<number>(B.length + 1).fill(0));
for (let i = A.length - 1; i >= 0; i--)
  for (let j = B.length - 1; j >= 0; j--)
    L[i][j] = same(A[i], B[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
const words = (ls: string[]) =>
  ls.map((l) => l.replace(/^(⏺ )?\s*(#{1,6} )?/, "").replace(/\*\*|`/g, "")).join(" ").split(/\s+/).filter(Boolean).join(" ");
// Each ```markdown block of the replies, as words.
const blocks: string[] = [];
(function walk(x: unknown): void {
  if (!Array.isArray(x)) return void (x && typeof x === "object" && Object.values(x).forEach(walk));
  if (!x.every((l) => typeof l === "string")) return x.forEach(walk);
  x.forEach((l: string, k) => {
    const end = x.indexOf("```", k + 1);
    if (l === "```markdown" && end > k) blocks.push(words(x.slice(k + 1, end)));
  });
})(scene.turns);
let diffs = 0;
let rendered = 0;
const hunk = (a: string[], b: string[], at: number) => {
  if (!a.length && !b.length) return;
  const said = words(b);
  if (said && words(a) === said && blocks.some((w) => ` ${w} `.includes(` ${said} `))) return void (rendered += a.length);
  if (++diffs <= 4)
    console.log(`   row ${at}\n     ours: ${JSON.stringify(a.slice(0, 3))}\n     rec : ${JSON.stringify(b.slice(0, 3))}`);
};
let i = 0;
let j = 0;
let a0 = 0;
let b0 = 0;
// A blank row matched between two parted runs joins them into one hunk: a
// rendered block and its source part around blank rows that need not align.
while (i < A.length || j < B.length) {
  if (i < A.length && j < B.length && same(A[i], B[j]) && (A[i] !== "" || (i === a0 && j === b0))) {
    hunk(A.slice(a0, i), B.slice(b0, j), a0);
    a0 = ++i;
    b0 = ++j;
  } else if (i < A.length && j < B.length && same(A[i], B[j])) {
    i++;
    j++;
  } else if (j >= B.length || (i < A.length && L[i + 1][j] >= L[i][j + 1])) i++;
  else j++;
}
hunk(A.slice(a0), B.slice(b0), a0);
const note = rendered ? `, ${rendered} rendered from markdown` : "";
console.log(diffs ? `DIFF ${diffs} hunks of ${A.length} rows` : `ok ${A.length} rows${note}`);
process.exit(diffs ? 1 : 0);
