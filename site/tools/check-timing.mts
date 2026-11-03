// Every demo the built site plays, held to the idle cap and to its recording:
// 1. No screen stands still longer than IDLE seconds unless it shows words to
//    read: words in rows newly shown, at READ's pace, from the last change of
//    the burst that showed them. Frames sampled 30 a second at 80 columns;
//    the spinner and the status line are not news, a caption and a toast are.
// 2. Each chapter starts within a frame of its skill's launch, as the session
//    file logs it (the prompt that ran it, or its Skill call), and ends at the
//    next launch in that turn or the turn's reply, whichever comes first; the
//    activity line on screen there is the one recorded at that moment.
// Usage: check-timing.mts <site dist dir> <dir of gen.py's raw turns>. Run
// npm run build and gen.sh first: the pages' demos come from the build, and
// each session file's path from gen.py's <page>.src.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { demoTime, frame, IDLE, phases, READ, words, type Row } from "../src/demo/render.ts";
import * as S from "../src/demo/scenes.ts";
import type { Scene } from "../src/demo/types.ts";

const [dist, raw] = process.argv.slice(2);
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
type Demo = { scene: Scene; chips: { at: number; end: number }[] };
const pages = html(dist).flatMap((file) =>
  [...readFileSync(file, "utf8").matchAll(/data-demo="([^"]*)"/g)].map((m) => ({
    page: file.slice(dist.length + 1).replace(/(index)?\.html$/, "") || "/",
    demo: JSON.parse(unescape(m[1])) as Demo,
  })),
);
if (!pages.length) throw new Error(`${dist}: no demo pages; run npm run build first`);
// Each page's scene by name, from scenes.ts: "chainScene" plays gen.py's chain.
const named = Object.entries(S) as [string, Scene][];
const sceneOf = (d: Demo) => {
  const hit = named.find(([, s]) => JSON.stringify(s.turns) === JSON.stringify(d.scene.turns));
  if (!hit) throw new Error(`a page plays a scene scenes.ts does not export: "${d.scene.turns[0].user}"`);
  return { name: hit[0].replace(/Scene$/, ""), scene: hit[1] };
};

const text = (r: Row) => r.segs.map(([c, k]) => (k === "logo" ? "" : c)).join("");
const SPIN = /^[·✢✳✶✻✽] /;
/** What a reader can read at `s`: transcript and bottom rows, the status line
 * and spinner aside, then the caption and the toast. */
function shown(scene: Scene, s: number): string[] {
  const f = frame(scene, s, 80);
  return [
    ...[...f.transcript, ...f.bottom.slice(0, -1)].map(text).filter((r) => !SPIN.test(r)),
    `caption: ${scene.beats[f.beat]?.text ?? ""}`,
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

// 1. Idle time, once per scene.
const seen = new Set<string>();
for (const { page, demo } of pages) {
  const { name, scene } = sceneOf(demo);
  if (seen.has(name)) continue;
  seen.add(name);
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
  const bad = worst.over > FRAME;
  say(bad, `${name.padEnd(12)} ${length.toFixed(1).padStart(6)} s; ${bad ? `stands ${worst.run.toFixed(2)} s at ${worst.at.toFixed(2)} s, ${worst.over.toFixed(2)} s past what it shows to read` : "no idle stand past the cap"} (${page})`);
}

// 2. Chapters, on every page: each against its session file.
type Rec = { type?: string; timestamp?: string; isMeta?: boolean; message?: { content: unknown } };
const ts = (r: Rec) => Date.parse(r.timestamp!) / 1000;
// The session file logs milliseconds, and gen.py keeps them.
const ms = (s: number) => Math.round(s * 1000) / 1000;
for (const { page, demo } of pages) {
  const { name, scene } = sceneOf(demo);
  const src = join(raw, `${name}.src`);
  if (!existsSync(src)) throw new Error(`${src}: missing; run gen.sh first`);
  const recs: Rec[] = readFileSync(readFileSync(src, "utf8").trim(), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  // The session's turns as gen.py counts them: a task notification joins the turn before.
  const prompts = recs.flatMap((r, k) =>
    r.type === "user" && typeof r.message?.content === "string" && !r.isMeta ? [k] : [],
  );
  const turns = prompts.filter((k) => !(recs[k].message!.content as string).startsWith("<task-notification>"));
  if (turns.length !== scene.turns.length) throw new Error(`${name}: ${turns.length} turns in the session file, ${scene.turns.length} in the scene`);
  // Every launch, recorded: [turn, seconds after its prompt, skill's last part].
  const launches = turns.flatMap((a, i) => {
    const b = prompts.find((k) => k > a && turns.includes(k)) ?? recs.length;
    const sent = ts(recs[a]);
    const typed = (recs[a].message!.content as string).match(/<command-name>\/(\S+?)<\/command-name>/)?.[1];
    const calls = recs.slice(a, b).flatMap((r) =>
      r.type === "assistant"
        ? (r.message!.content as { type: string; name?: string; input?: { skill: string } }[])
            .filter((c) => c.type === "tool_use" && c.name === "Skill")
            .map((c) => ({ i, at: ms(ts(r) - sent), skill: c.input!.skill }))
        : [],
    );
    const said = recs.slice(a, b).filter((r) => r.type === "assistant" && (r.message!.content as { type: string; text?: string }[]).some((c) => c.type === "text" && c.text?.trim()));
    const reply = said.length ? ts(said[said.length - 1]) - sent : NaN;
    return [...(typed ? [{ i, at: 0, skill: typed }] : []), ...calls].map((l) => ({ ...l, name: l.skill.split(":").pop()!, reply }));
  });
  const { timing } = phases(scene);
  const msgs: string[] = [];
  const names: string[] = [];
  demo.chips.forEach((chip, c) => {
    // The chapter's move: the launch whose demo time it starts at.
    const near = launches
      .map((l) => ({ l, at: demoTime(scene, l.i, l.at) }))
      .sort((x, y) => Math.abs(x.at - chip.at) - Math.abs(y.at - chip.at))[0];
    const { l, at } = near;
    names.push(l.name);
    const next = launches.find((x) => x.i === l.i && x.at > l.at);
    const end = Math.min(next ? demoTime(scene, l.i, next.at) : Infinity, demoTime(scene, l.i, l.reply));
    if (Math.abs(chip.at - at) > FRAME) msgs.push(`/${l.name} starts at ${chip.at.toFixed(3)} s, launched at ${at.toFixed(3)} s`);
    if (Math.abs(chip.end - end) > FRAME) msgs.push(`/${l.name} ends at ${chip.end.toFixed(3)} s, not ${end.toFixed(3)} s`);
    // On screen at the launch: the activity line recorded on screen then.
    const acts = scene.turns[l.i].activity ?? [];
    const k = acts.findLastIndex((a) => a.at <= l.at);
    const p = timing[l.i];
    if (k >= 0 && !(p.acts[k] <= chip.at + FRAME && chip.at <= (p.acts[k + 1] ?? p.reply) + FRAME))
      msgs.push(`/${l.name}: the line recorded on screen at its launch, "${acts[k].line.slice(0, 40)}", is not on screen at ${chip.at.toFixed(2)} s`);
  });
  say(msgs.length > 0, `${page.padEnd(32)} ${names.map((n, c) => `/${n} ${demo.chips[c].at.toFixed(1)}–${demo.chips[c].end.toFixed(1)}`).join(", ")}${msgs.map((m) => `\n       ${m}`).join("")}`);
}
console.log(fail ? `${fail} demos break the idle cap or their chapters` : "every demo holds the idle cap and its chapters");
process.exit(fail ? 1 : 0);
