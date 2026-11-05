// The agent reader of the demo plan: a fresh Claude, with no moo context,
// sees each pane of a page's pair only at the moments it waits on the user
// and says whether those frames show what the page's line claims. Every page
// also gets three decoys built by rule, which it must reject: the pair against
// the next page's line, the moo-off pane in both panes, and the panes swapped.
// Each case runs `--runs` times; the majority decides. A layout passes when
// the real case passes and every decoy fails, or a ruling (RULINGS) counts the
// decoy's verdict as the reader's miss; a page, when every layout and its
// prompt check (check-prompts.mts) pass.
//
// The reader is a model's judgment: a rate, never a guarantee. Read its
// decoy rejection rate before trusting a pass.
//
// Usage: read-demo.mts [--cols 45] [--rows 26] [--runs 3] [--jobs 6]
//                      [--page clarify] [--frames] [--out dir]
// The pane is render.ts PANE by default: 45 columns, the narrowest a page
// plays, at the fewest rows a page plays.
// --frames prints each page's wait frames and calls no model. Each verdict is
// kept under --out (default $TMPDIR/moo-demo-reader), named for a hash of
// what the reader is asked, and reused on a rerun only for that same ask;
// the report, Markdown, goes to stdout.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { frame, PANE, waits } from "../src/demo/render.ts";
import type { Row } from "../src/demo/render.ts";
import type { Scene } from "../src/demo/types.ts";
import { pages, promptMatch, type Page } from "./pages.mts";

const { values: opt } = parseArgs({
  options: {
    cols: { type: "string", default: String(PANE.cols) },
    rows: { type: "string", default: String(PANE.rows) },
    runs: { type: "string", default: "3" },
    jobs: { type: "string", default: "6" },
    page: { type: "string" },
    frames: { type: "boolean", default: false },
    out: { type: "string", default: join(process.env.TMPDIR ?? "/tmp", "moo-demo-reader") },
  },
});
const LAYOUTS = opt.cols.split(",").map(Number);
const ROWS_ = +opt.rows;
const RUNS = +opt.runs;

// ---- Wait frames ----------------------------------------------------------

const text = (r: Row) =>
  r.segs.map(([t, c]) => (c === "logo" ? "▟▙" : t)).join("").replace(/\xa0/g, " ").trimEnd();

type Wait = { what: string; rows: string[] };

/** Each moment a pane waits on the user (render.ts waits()), as the pane
 * shows it: the transcript rows above what sits below them, scrolled as the
 * player stands, to the newest reply's first row once one is in. */
function waitFrames(scene: Scene, cols: number, rows = ROWS_): Wait[] {
  return waits(scene).map((w) => {
    const f = frame(scene, w.at, cols, undefined, rows);
    const room = Math.max(0, rows - f.bottom.length);
    const end = Math.max(0, f.transcript.length - room);
    const from = Math.min(end, f.top ?? end);
    const turn = scene.turns.length > 1 ? `turn ${w.turn + 1}, ` : "";
    return {
      what: turn + (w.on === "dialog" ? `dialog ${w.d + 1}, question ${w.q + 1}` : w.n ? `reply ${w.n + 1}` : "the reply"),
      rows: [...f.transcript.slice(from, from + room), ...f.bottom].map(text),
    };
  });
}

const show = (ws: Wait[]) =>
  ws.map((w, k) => `--- wait ${k + 1} of ${ws.length}: ${w.what} ---\n${w.rows.join("\n")}`).join("\n\n");

// ---- Cases ----------------------------------------------------------------

type Kind = "real" | "other-line" | "off-off" | "swapped";
const KINDS: Kind[] = ["real", "other-line", "off-off", "swapped"];
type Case = { kind: Kind; line: string; lineOf: string; off: Wait[]; on: Wait[] };

function cases(page: Page, next: Page, cols: number): Case[] {
  const off = waitFrames(page.pair.off, cols);
  const on = waitFrames(page.pair.on, cols);
  const own = { line: page.line, lineOf: page.slug };
  return [
    { kind: "real", ...own, off, on },
    { kind: "other-line", line: next.line, lineOf: next.slug, off, on },
    { kind: "off-off", ...own, off, on: off },
    { kind: "swapped", ...own, off: on, on: off },
  ];
}

/** What marks the moo-on pane whatever its label says, as the page draws it. */
const marks = (ws: Wait[]) => {
  const all = ws.flatMap((w) => w.rows).join("\n");
  return [
    /\/hope:\w/.test(all) && "prefix",
    /hold:Plain/.test(all) && "style",
    /\[-\]/.test(all) && "band",
  ].filter(Boolean) as string[];
};

// ---- The reader -----------------------------------------------------------

const SYSTEM =
  "You judge whether a web page's demo shows what the page claims. You read only the text you are given and answer in the JSON asked for.";

const ask = (c: Case) => `A web page shows two terminal panes side by side. Each runs Claude Code, an AI coding agent, on a user's ask. One pane is labelled "moo off", the other "moo on". Above them the page has one line, which claims what the user gets with moo on:

LINE: "${c.line}"

Below, each pane is shown only at the moments it stops and waits on the user: a dialog asking a question, or its reply once it is done. Each frame is the text the terminal shows at that moment, nothing more; what scrolled off or lies below is not visible.

Decide whether these frames alone show the difference the line claims: the "moo on" pane gives the user what the line says, and the "moo off" pane does not. A frame that only hints at it, or a difference other than the one the line names, does not count. First say in your own words what the moo-on frames show that the moo-off frames do not, then decide.

=== moo off ===
${show(c.off)}

=== moo on ===
${show(c.on)}`;

const SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    difference: { type: "string", description: "What the moo-on frames show that the moo-off frames do not, or 'none'." },
    shown: { type: "boolean", description: "Whether the frames alone show the difference the line claims." },
    evidence: { type: "string", description: "The moo-on text that shows the line's claim, quoted; empty if none." },
  },
  required: ["difference", "shown", "evidence"],
  additionalProperties: false,
});

// The reader starts in an empty folder with no user, project or local
// settings: no plugins, skills, hooks, CLAUDE.md, MCP servers or tools.
const ISOLATE = [
  "--setting-sources", "",
  "--settings", '{"disableAllHooks":true,"outputStyle":"default"}',
  "--disable-slash-commands", "--strict-mcp-config", "--tools", "",
  "--no-session-persistence", "--model", "opus", "--effort", "high",
  "--system-prompt", SYSTEM,
];
const HOME = mkdtempSync(join(tmpdir(), "moo-reader-"));

function claude(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn("claude", ["-p", ...ISOLATE, ...args], { cwd: HOME, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => (code ? reject(new Error(`claude exited ${code}: ${err || out}`)) : resolve(out)));
  });
}

/** Fails loud unless the reader starts with nothing that knows moo: Claude
 * Code's own built-in plugins aside, no plugin, skill, command, MCP server or
 * tool, and the default output style. */
async function checkIsolation() {
  const out = await claude(["--output-format", "stream-json", "--verbose", "--", "Say ok."]);
  const init = out.split("\n").map((l) => (l ? JSON.parse(l) : {})).find((e) => e.subtype === "init");
  if (!init) throw new Error("the reader's session sent no init event");
  const leaks = [
    init.tools?.length && `tools ${init.tools}`,
    init.mcp_servers?.length && `MCP servers ${JSON.stringify(init.mcp_servers)}`,
    init.skills?.length && `skills ${init.skills}`,
    init.slash_commands?.length && `commands ${init.slash_commands}`,
    init.plugins?.some((p: { path: string }) => p.path !== "builtin") && `plugins ${JSON.stringify(init.plugins)}`,
    init.output_style !== "default" && `output style ${init.output_style}`,
  ].filter(Boolean);
  if (leaks.length) throw new Error(`the reader is not fresh: ${leaks.join("; ")}`);
  return init.model as string;
}

type Verdict = { difference: string; shown: boolean; evidence: string };

async function read(c: Case, file: string): Promise<Verdict> {
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")).verdict;
  const out = JSON.parse(await claude(["--output-format", "json", "--json-schema", SCHEMA, "--", ask(c)]));
  const verdict: Verdict | undefined = out.structured_output;
  if (!verdict || typeof verdict.shown !== "boolean") throw new Error(`no verdict in ${JSON.stringify(out).slice(0, 400)}`);
  writeFileSync(file, JSON.stringify({ case: { kind: c.kind, lineOf: c.lineOf, line: c.line }, verdict, cost: out.total_cost_usd }, null, 1));
  return verdict;
}

async function pool<T>(tasks: (() => Promise<T>)[], n: number): Promise<T[]> {
  const out: T[] = [];
  let k = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (k < tasks.length) {
        const i = k++;
        out[i] = await tasks[i]();
      }
    }),
  );
  return out;
}

// ---- Rulings ---------------------------------------------------------------
// A ruling counts one decoy's yes votes as the reader's miss, for the exact
// ask it judged: the hash names the frames and the line the reader read, so
// a change to either ends the ruling, and the report says so. The report shows
// each ruling beside its cell; the rates stay the reader's own.

type Ruling = { page: string; kind: Exclude<Kind, "real">; hash: string; by: string; why: string };
const RULINGS: Ruling[] = [
  {
    page: "interrogate",
    kind: "other-line",
    hash: "29fd85ade183",
    by: "the Door, 2026-11-05",
    why: 'The "step that stops it" the reader cites, "1. Same verdict 10/10", is an option in an open dialog, not a step moo hands over.',
  },
];

// ---- Run ------------------------------------------------------------------

const all = pages();
const paired = all.filter((p) => p.pair.off.turns.length);
const chosen = paired.filter((p) => !opt.page || p.slug === opt.page);
if (!chosen.length) throw new Error(`no paired page named ${opt.page}`);
// The other-line decoy takes the next paired page's line, in page-file order.
const nextOf = (p: Page) => paired[(paired.indexOf(p) + 1) % paired.length];

if (opt.frames) {
  for (const page of chosen)
    for (const cols of LAYOUTS) {
      const [real] = cases(page, nextOf(page), cols);
      console.log(`######## ${page.slug} at ${cols} columns\n=== moo off ===\n${show(real.off)}\n\n=== moo on ===\n${show(real.on)}\n`);
    }
  process.exit(0);
}

const model = await checkIsolation();
type Job = { page: Page; cols: number; c: Case; run: number; hash: string };
const hashOf = (c: Case) => createHash("sha256").update(ask(c)).digest("hex").slice(0, 12);
const jobs: Job[] = chosen.flatMap((page) =>
  LAYOUTS.flatMap((cols) =>
    cases(page, nextOf(page), cols).flatMap((c) => Array.from({ length: RUNS }, (_, run) => ({ page, cols, c, run, hash: hashOf(c) }))),
  ),
);
const verdicts = await pool(
  jobs.map((j) => () => {
    const dir = join(opt.out, `${j.cols}x${ROWS_}`);
    mkdirSync(dir, { recursive: true });
    return read(j.c, join(dir, `${j.page.slug}.${j.c.kind}.${j.run}.${j.hash}.json`)).then((v) => {
      process.stderr.write(`${j.page.slug} ${j.cols} ${j.c.kind} ${j.run}: ${v.shown}\n`);
      return v;
    });
  }),
  +opt.jobs,
);

// ---- Report ---------------------------------------------------------------

const votes = (page: Page, cols: number, kind: Kind) =>
  jobs.flatMap((j, i) => (j.page === page && j.cols === cols && j.c.kind === kind ? [verdicts[i].shown] : []));
/** The ruling on a page's decoy at a layout, if one covers the ask it judged;
 * a ruling whose ask changed covers nothing. */
const ruled = (page: Page, cols: number, kind: Kind) =>
  RULINGS.find(
    (r) => r.page === page.slug && r.kind === kind && jobs.some((j) => j.page === page && j.cols === cols && j.c.kind === kind && j.hash === r.hash),
  );
const yes = (vs: boolean[]) => vs.filter(Boolean).length;
const major = (vs: boolean[]) => yes(vs) * 2 > vs.length;
const cell = (vs: boolean[], want: boolean) => `${major(vs) === want ? "✓" : "✗"} ${yes(vs)}/${vs.length}`;

const out: string[] = [];
out.push(`Reader: claude -p, ${model}, effort high, fresh (isolation checked). ${RUNS} runs a case; ${ROWS_} rows; layouts ${LAYOUTS.join(" and ")} columns.`, "");
out.push("A cell reads ✓ when the majority went the right way, then yes votes over runs: the real case wants yes, each decoy no.", "");
const pass = new Map<Page, boolean>();
for (const cols of LAYOUTS) {
  out.push(`### ${cols} columns`, "", "| page | real | other line | off/off | swapped | pane marks | layout |", "|---|---|---|---|---|---|---|");
  for (const page of chosen) {
    const ok = major(votes(page, cols, "real")) && KINDS.slice(1).every((k) => !major(votes(page, cols, k)) || ruled(page, cols, k));
    pass.set(page, (pass.get(page) ?? true) && ok);
    const m = marks(waitFrames(page.pair.on, cols)).join(", ") || "none";
    out.push(`| ${page.slug} | ${cell(votes(page, cols, "real"), true)} | ${KINDS.slice(1).map((k) => cell(votes(page, cols, k), false) + (ruled(page, cols, k) ? " (ruled a miss)" : "")).join(" | ")} | ${m} | ${ok ? "pass" : "fail"} |`);
  }
  out.push("");
}
out.push("### Rates", "", "| case | right | of |", "|---|---|---|");
for (const kind of KINDS) {
  const vs = chosen.flatMap((p) => LAYOUTS.flatMap((c) => votes(p, c, kind)));
  const right = kind === "real" ? yes(vs) : vs.length - yes(vs);
  out.push(`| ${kind === "real" ? "real accepted" : `${kind} rejected`} | ${right} | ${vs.length} |`);
}
const rulings = RULINGS.filter((r) => chosen.some((p) => p.slug === r.page));
if (rulings.length) {
  out.push("", "### Rulings", "", "A ruled cell counts as rejected, whatever the reader voted.", "", "| page | decoy | ruling |", "|---|---|---|");
  for (const r of rulings) {
    const page = chosen.find((p) => p.slug === r.page)!;
    const holds = LAYOUTS.every((cols) => ruled(page, cols, r.kind));
    out.push(`| ${r.page} | ${r.kind} | ${holds ? `${r.by}: ${r.why}` : `**not applied**: the ask changed since ${r.by} ruled on ask ${r.hash}`} |`);
  }
}
out.push("", "### Pages", "", "| page | prompt check | reader | page |", "|---|---|---|---|");
for (const page of all) {
  const pm = promptMatch(page);
  const r = !paired.includes(page) ? "no moo-off take" : !chosen.includes(page) ? "not run" : pass.get(page) ? "pass" : "fail";
  out.push(`| ${page.slug} | ${pm.ok ? "pass" : "fail"} | ${r} | ${pm.ok && r === "pass" ? "pass" : "fail"} |`);
}
out.push("", "Other-line pairings: " + chosen.map((p) => `${p.slug}→${nextOf(p).slug}`).join(", "));
console.log(out.join("\n"));
