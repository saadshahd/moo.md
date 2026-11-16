#!/usr/bin/env bun
/**
 * Measures the short-reply redraw on real redraws through tend's own code in the engine: it copies
 * hunch's hooks into a scratch plugin beside a command that runs every case, runs that command
 * headless, and scores every run in --out against the cases' verdicts.
 *
 *   bun hunch/skills/short-replies/eval.ts <cases.jsonl> --out <folder> [--runs <n>] [--redraws <n>]
 *
 * A case is one JSON line: {"id", "cut": whether readers found the short form dropped something the
 * user needed, "answer": the reply as sent, card and all, "long": the reply tend redrew, "short": the
 * short form it showed}. A label run lists each long reply's cover items, labels each against its short
 * form, and runs the code check; a redraw run runs the whole redraw on each long reply. Runs add to
 * --out, so `--runs 0` rescores the runs there without a model call.
 */
import { $ } from "bun";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const USAGE =
  "usage: eval.ts <cases.jsonl> --out <folder> [--runs <n>] [--redraws <n>]";
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    runs: { type: "string", default: "1" },
    redraws: { type: "string", default: "0" },
    out: { type: "string" },
  },
});
const [casesPath] = positionals;
if (!casesPath || !values.out) throw new Error(USAGE);

type Case = { id: string; cut: boolean };
const cases = readFileSync(casesPath, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l) as Case);
const out = resolve(values.out);
mkdirSync(out, { recursive: true });

/** The two kinds of run, each with the flag that counts it and the files it writes in --out. */
const MODES = {
  label: { flag: "runs", file: /^label-\d+\.json$/ },
  redraw: { flag: "redraws", file: /^redraw-\d+\.json$/ },
} as const;
type Mode = keyof typeof MODES;
const runFiles = (mode: Mode) =>
  readdirSync(out).filter((f) => MODES[mode].file.test(f));
const runsAsked = (mode: Mode) => {
  const flag = MODES[mode].flag;
  const n = Number(values[flag]);
  if (!Number.isInteger(n) || n < 0)
    throw new Error(`--${flag} takes a whole number, not ${values[flag]}`);
  return n;
};

// The command runs each case with tend's own cover, label, code check and redraw, a few at once.
const EVAL_MODULE = `import type { Register } from "claude-code";
import { register as tend, cover, expertsNamed, lostTokens, missingItems, prose, redraw } from "./tend.tsx";
const AT_ONCE = 8;
async function labelOne($: any, c: any) {
    const items = await cover($, c.long);
    return { items, missing: await missingItems($, items, c.short), lost: lostTokens(c.long, c.short, expertsNamed(c.answer)) };
}
async function redrawOne($: any, c: any) {
    const from = Date.now();
    const { items, passes, step } = await redraw($, c.long, expertsNamed(c.answer));
    const ms = Date.now() - from;
    const shown = step.kind === "show" ? step.pass.text : undefined;
    return {
      ms,
      end: step.kind,
      why: step.kind === "long" ? step.why : undefined,
      passes,
      shownAt: step.kind === "show" ? passes.indexOf(step.pass) + 1 : 0,
      items,
      shown,
      chars: [prose(c.long).length, prose(shown ?? c.long).length],
      report: shown ? await missingItems($, items, shown) : [],
    };
}
export const register: Register = (on, options) => {
  tend(on, options);
  on("session.start", { isInteractive: false }, async ($, e, next) => {
    await $.command.register({ name: "redraw-eval", description: "Run the redraw's eval cases", immediate: true });
    return next(e);
  });
  on("command.run", { command: "redraw-eval" }, async ($, e) => {
    const [mode, from, to] = e.args.trim().split(/\\s+/);
    const cases = (await $.fs.read(from)).split("\\n").filter(Boolean).map((l: string) => JSON.parse(l));
    const done: any[] = [];
    for (let i = 0; i < cases.length; i += AT_ONCE)
      done.push(...(await Promise.all(cases.slice(i, i + AT_ONCE).map(async (c: any) => ({
        id: c.id,
        ...(await (mode === "redraw" ? redrawOne($, c) : labelOne($, c)).catch((err: Error) => ({ error: err.message }))),
      })))));
    await $.fs.write(to, JSON.stringify(done));
    return { text: \`\${done.length} cases run\` };
  });
};
`;

/** A scratch copy of hunch whose hooks module adds the eval command. */
function scratchPlugin(): string {
  const hunch = resolve(import.meta.dir, "../..");
  const plugin = mkdtempSync(join(tmpdir(), "redraw-eval-"));
  cpSync(join(hunch, "hooks"), join(plugin, "hooks"), {
    recursive: true,
    filter: (f) => !f.endsWith(".test.ts"),
  });
  mkdirSync(join(plugin, ".claude-plugin"));
  writeFileSync(
    join(plugin, ".claude-plugin/plugin.json"),
    JSON.stringify({
      name: "hunch",
      version: "0.0.0",
      description: "Runs the redraw's eval cases",
    }),
  );
  writeFileSync(
    join(plugin, "hooks/hooks.json"),
    JSON.stringify({ modules: ["./eval.tsx"] }),
  );
  writeFileSync(join(plugin, "hooks/eval.tsx"), EVAL_MODULE);
  return plugin;
}

async function runAll(plugin: string, mode: Mode, to: string) {
  const r =
    await $`claude -p --setting-sources "" --strict-mcp-config --no-session-persistence --plugin-dir ${plugin} ${`/redraw-eval ${mode} ${resolve(casesPath!)} ${to}`}`
      .env({ ...process.env, ENABLE_CLAUDEAI_MCP_SERVERS: "false" })
      .nothrow()
      .quiet();
  if (r.exitCode !== 0 || !existsSync(to))
    throw new Error(
      `${to} ran nothing (exit ${r.exitCode}): ${r.stderr.toString() || r.stdout.toString()}`,
    );
}

const modes = Object.keys(MODES) as Mode[];
const plugin = modes.some(runsAsked) ? scratchPlugin() : "";
for (const mode of modes) {
  const first = runFiles(mode).length + 1;
  for (let run = first; run < first + runsAsked(mode); run++)
    await runAll(plugin, mode, join(out, `${mode}-${run}.json`));
}

const read = (f: string): any[] => JSON.parse(readFileSync(join(out, f), "utf8"));
const verdict = new Map(cases.map((c) => [c.id, c.cut]));
const rate = (n: number, of: number) => (of ? (n / of).toFixed(2) : "n/a");
const median = (xs: number[]) =>
  [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? NaN;
const today = new Date().toISOString().slice(0, 10);

/** How a check's calls meet the readers' verdicts: cut cases it caught, kept ones it left alone. */
function score(calls: { id: string; cut: boolean }[]) {
  const on = (cut: boolean) => calls.filter((c) => verdict.get(c.id) === cut);
  const caught = on(true).filter((c) => c.cut).length;
  const kept = on(false).filter((c) => !c.cut).length;
  return {
    caught: `${caught}/${on(true).length} (${rate(caught, on(true).length)})`,
    kept: `${kept}/${on(false).length} (${rate(kept, on(false).length)})`,
  };
}

/** What each check calls a cut, from one case's label run. */
const CHECKS: Record<string, (c: any) => boolean> = {
  "model label": (c) => c.missing.length > 0,
  "code check": (c) => c.lost.length > 0,
  either: (c) => c.missing.length > 0 || c.lost.length > 0,
};

const labelRuns = runFiles("label").map(read);
if (labelRuns.length) {
  const answered = labelRuns.map((run) => run.filter((c) => !c.error));
  const unanswered = labelRuns.flat().length - answered.flat().length;
  console.log(`| date | check | runs | cases | cut caught | kept left alone | caught, kept each run | no answer |
|---|---|---|---|---|---|---|---|`);
  for (const [name, says] of Object.entries(CHECKS)) {
    const calls = (run: any[]) => run.map((c) => ({ id: c.id, cut: says(c) }));
    const all = score(calls(answered.flat()));
    const each = answered
      .map((run) => Object.values(score(calls(run))).join(", "))
      .join("; ");
    console.log(
      `| ${today} | ${name} | ${answered.length} | ${answered.flat().length} | ${all.caught} | ${all.kept} | ${each} | ${unanswered} |`,
    );
  }
}

const redraws = runFiles("redraw").map(read).flat();
if (redraws.length) {
  const shown = redraws.filter((c) => c.end === "show");
  const long = redraws.filter((c) => c.end === "long");
  const longFor = (why: RegExp) => long.filter((c) => why.test(c.why ?? "")).length;
  const atPass = [1, 2, 3].map((n) => shown.filter((c) => c.shownAt === n).length);
  const cut = shown.map((c) => 1 - c.chars[1] / c.chars[0]);
  console.log(`
| date | redraws | shown short | long: lost a token | long: cut off | long: saved nothing | failed | shown at pass 1, 2, 3 | prose cut, median | seconds, median | label reports |
|---|---|---|---|---|---|---|---|---|---|---|
| ${today} | ${redraws.length} | ${shown.length} | ${longFor(/dropped/)} | ${longFor(/ran out of room/)} | ${long.filter((c) => !c.why).length} | ${redraws.filter((c) => c.error).length} | ${atPass.join(", ")} | ${(median(cut) * 100).toFixed(0)}% | ${(median(redraws.filter((c) => c.ms).map((c) => c.ms)) / 1000).toFixed(0)} | ${shown.filter((c) => c.report.length).length} |`);
}
