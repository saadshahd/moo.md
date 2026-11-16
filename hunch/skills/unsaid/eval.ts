#!/usr/bin/env bun
/**
 * Measures unsaid's said/assumed label on real work orders through the mod's own code in the engine:
 * it copies hunch's hooks into a scratch plugin beside a command that labels every case, runs that
 * command headless, and scores every run in --out against the labels in the cases file.
 *
 *   bun hunch/skills/unsaid/eval.ts <cases.jsonl> --out <folder> [--runs <n>]
 *
 * A case is one JSON line: {"id", "messages": SessionMessage[] up to the order, "lines": [{"kind",
 * "text", "label"?}]}. The model labels the kinds unsaid checks; a line the cases leave unlabelled counts
 * in no rate. Runs add to --out, so `--runs 0` rescores the runs there without a model call.
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

const USAGE = "usage: eval.ts <cases.jsonl> --out <folder> [--runs <n>]";
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { runs: { type: "string", default: "1" }, out: { type: "string" } },
});
const [casesPath] = positionals;
if (!casesPath || !values.out) throw new Error(USAGE);
const runs = Number(values.runs);
if (!Number.isInteger(runs) || runs < 0)
  throw new Error(`--runs takes a whole number, not ${values.runs}`);

type Line = { kind: string; text: string; label?: string; got?: string };
type Case = { id: string; lines: Line[] };
const cases = readFileSync(casesPath, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l) as Case);
const out = resolve(values.out);
mkdirSync(out, { recursive: true });
const RUN_FILE = /^run-\d+\.json$/;
const runFiles = () => readdirSync(out).filter((f) => RUN_FILE.test(f));

// The command labels each case's checked lines with the mod's own words and label functions.
const EVAL_MODULE = `import type { Register } from "claude-code";
import { register as hunch } from "./index.tsx";
import { CHECKED, label, userWords } from "./unsaid.tsx";
export const register: Register = (on, options) => {
  hunch(on, options);
  on("session.start", { isInteractive: false }, async ($, e, next) => {
    await $.command.register({ name: "unsaid-eval", description: "Label unsaid's eval cases", immediate: true });
    return next(e);
  });
  on("command.run", { command: "unsaid-eval" }, async ($, e) => {
    const [from, to] = e.args.trim().split(/\\s+/);
    const cases = (await $.fs.read(from)).split("\\n").filter(Boolean).map((l: string) => JSON.parse(l));
    const done = [];
    for (const c of cases) {
      const words = userWords(c.messages);
      const lines = await Promise.all(c.lines.filter((l: any) => CHECKED[l.kind]).map(async (l: any) => ({
        kind: l.kind,
        text: l.text,
        got: await label($, words, l.text).catch((err: Error) => \`error: \${err.message}\`),
      })));
      done.push({ id: c.id, words, lines });
    }
    await $.fs.write(to, JSON.stringify(done));
    return { text: \`\${done.length} cases labelled\` };
  });
};
`;

/** A scratch copy of hunch whose hooks module adds the labelling command. */
function scratchPlugin(): string {
  const hunch = resolve(import.meta.dir, "../..");
  const plugin = mkdtempSync(join(tmpdir(), "unsaid-eval-"));
  cpSync(join(hunch, "hooks"), join(plugin, "hooks"), {
    recursive: true,
    filter: (f) => !f.endsWith(".test.ts"),
  });
  cpSync(join(hunch, "unsaid.d.ts"), join(plugin, "unsaid.d.ts"));
  mkdirSync(join(plugin, ".claude-plugin"));
  writeFileSync(
    join(plugin, ".claude-plugin/plugin.json"),
    JSON.stringify({
      name: "hunch",
      version: "0.0.0",
      description: "Labels unsaid's eval cases",
      types: "./unsaid.d.ts",
    }),
  );
  writeFileSync(
    join(plugin, "hooks/hooks.json"),
    JSON.stringify({ modules: ["./eval.tsx"] }),
  );
  writeFileSync(join(plugin, "hooks/eval.tsx"), EVAL_MODULE);
  return plugin;
}

async function labelAll(plugin: string, to: string) {
  const r =
    await $`claude -p --setting-sources "" --strict-mcp-config --no-session-persistence --plugin-dir ${plugin} ${`/unsaid-eval ${resolve(casesPath!)} ${to}`}`
      .env({ ...process.env, ENABLE_CLAUDEAI_MCP_SERVERS: "false" })
      .nothrow()
      .quiet();
  if (r.exitCode !== 0 || !existsSync(to))
    throw new Error(
      `${to} labelled nothing (exit ${r.exitCode}): ${r.stderr.toString() || r.stdout.toString()}`,
    );
}

const first = runFiles().length + 1;
const plugin = runs ? scratchPlugin() : "";
for (let run = first; run < first + runs; run++)
  await labelAll(plugin, join(out, `run-${run}.json`));

const key = (id: string, text: string) => `${id}\n${text}`;
const expected = new Map(
  cases.flatMap((c) =>
    c.lines.flatMap((l) =>
      l.label ? [[key(c.id, l.text), l.label] as const] : [],
    ),
  ),
);
const scored = runFiles().map((f) =>
  (JSON.parse(readFileSync(join(out, f), "utf8")) as Case[])
    .flatMap((c) =>
      c.lines.map((l) => ({
        want: expected.get(key(c.id, l.text)),
        got: l.got,
      })),
    )
    .filter((l) => l.want),
);
const all = scored.flat();
const count = (keep: (l: (typeof all)[number]) => boolean) =>
  all.filter(keep).length;
const rate = (n: number, of: number) => (of ? (n / of).toFixed(2) : "n/a");
const right = (ls: typeof all) => ls.filter((l) => l.got === l.want).length;
const assumed = count((l) => l.want === "assumed");
const caught = count((l) => l.want === "assumed" && l.got === "assumed");
const said = count((l) => l.want === "said");
const kept = count((l) => l.want === "said" && l.got === "said");
const unlabelled = count((l) => !l.got || l.got.startsWith("error:"));
const eachRun = scored.map((s) => rate(right(s), s.length)).join(", ");
const today = new Date().toISOString().slice(0, 10);

console.log(`| date | runs | lines | rate | each run | assumed caught | said kept | no label |
|---|---|---|---|---|---|---|---|
| ${today} | ${scored.length} | ${all.length} | ${rate(right(all), all.length)} | ${eachRun} | ${caught}/${assumed} | ${kept}/${said} | ${unlabelled} |`);
