#!/usr/bin/env bun
/**
 * Checks each rule of a TLA+ spec with TLC, then draws the model's states as a Mermaid statechart in the
 * words a view module gives, with the path to each rule that breaks.
 *
 *   bun statechart.ts SPEC.tla [--config FILE] [--view FILE] [--out DIR] [--chart-states 500] [--arrows 20]
 *
 * TLA2TOOLS names tla2tools.jar; JAVA names a Java 11 or later binary, \`java\` when unset.
 * Exits 0 when every rule holds, 1 when a rule breaks, 2 when it cannot check or draw.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { $ } from "bun";
import { draw, Refusal, type Verdict, type View } from "./chart.ts";
import { configText, definitionLevels, parseDot, pathGraph, readConfig, readRun, stateKey, TEMPORAL_LEVEL, type Trace } from "./tlc.ts";

const USAGE = "usage: statechart.ts SPEC.tla [--config FILE] [--view FILE] [--out DIR] [--chart-states N] [--arrows N]";
const VIOLATION_EXITS = new Set([10, 11, 12, 13]);

const fail = (message: string): never => {
	console.error(`statechart: ${message}`);
	process.exit(2);
};

const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		config: { type: "string" },
		view: { type: "string" },
		out: { type: "string" },
		"chart-states": { type: "string", default: "500" },
		arrows: { type: "string", default: "20" },
	},
});
const jar = process.env.TLA2TOOLS ?? fail("set TLA2TOOLS to the path of tla2tools.jar, from https://github.com/tlaplus/tlaplus/releases");
const java = process.env.JAVA ?? "java";
const spec = resolve(positionals[0] ?? fail(USAGE));
const folder = dirname(spec);
const module = basename(spec, ".tla");
const config = readConfig(readFileSync(resolve(values.config ?? join(folder, `${module}.cfg`)), "utf8"));
const out = resolve(values.out ?? mkdtempSync(join(tmpdir(), `statechart-${module}-`)));
const work = mkdtempSync(join(tmpdir(), "statechart-run-"));
process.on("exit", () => rmSync(work, { recursive: true, force: true }));
mkdirSync(out, { recursive: true });

const tail = (text: string) => text.trim().split("\n").slice(-25).join("\n");

const sany = await $`${java} -cp ${jar} tla2sany.xml.XMLExporter -o -I ${folder} ${spec}`.cwd(folder).nothrow().quiet();
if (sany.exitCode !== 0) fail(`SANY cannot read ${spec}:\n${tail(sany.stdout.toString() + sany.stderr.toString())}`);
const levels = definitionLevels(sany.stdout.toString());

/** One TLC run on \`cfg\`; its output is kept in the out folder. A run TLC could not finish ends the command. */
async function tlc(name: string, cfg: string, flags: string[]) {
	const cfgFile = join(work, `${name}.cfg`);
	writeFileSync(cfgFile, cfg);
	const run = await $`${java} -XX:+UseParallelGC -cp ${jar} tlc2.TLC -workers 1 -metadir ${join(work, `meta-${name}`)} -config ${cfgFile} ${flags} ${module}`.cwd(folder).nothrow().quiet();
	const text = run.stdout.toString() + run.stderr.toString();
	writeFileSync(join(out, `tlc-${name}.out`), text);
	if (run.exitCode !== 0 && !VIOLATION_EXITS.has(run.exitCode)) fail(`TLC could not check ${spec} (exit ${run.exitCode}):\n${tail(text)}`);
	return readRun(text);
}

const broken = new Map<string, Trace>();
let distinct = 0;
for (let remaining = config.invariants, k = 1; ; k++) {
	const run = await tlc(`invariants-${k}`, configText(config.base, { invariants: remaining }), ["-deadlock"]);
	distinct = Math.max(distinct, run.distinct);
	const [first] = run.violations;
	if (!first?.rule) break;
	broken.set(first.rule, first.trace);
	remaining = remaining.filter((rule) => rule !== first.rule);
}
const deadlock = config.checksDeadlock ? (await tlc("deadlock", configText(config.base, {}), [])).violations[0]?.trace : undefined;
const properties = new Map<string, Trace | undefined>();
for (const rule of config.properties) properties.set(rule, (await tlc(`property-${rule}`, configText(config.base, { properties: [rule] }), ["-deadlock"])).violations[0]?.trace);

const complete = distinct <= Number(values["chart-states"]);
const lastKey = (trace: Trace) => stateKey(trace.states.at(-1)!.vars);
const chartRun = complete ? await tlc("chart", configText(config.base, { invariants: [...broken.keys()] }), ["-deadlock", "-continue", "-dump", "dot,actionlabels", join(work, "chart")]) : undefined;
const graph = chartRun ? parseDot(readFileSync(join(work, "chart.dot"), "utf8")) : pathGraph([...broken.values(), ...(deadlock ? [deadlock] : []), ...[...properties.values()].flatMap((t) => (t ? [t] : []))]);
const bounded = /\b(ACTION_)?CONSTRAINTS?\b/.test(config.base);
const deadEnds = [...graph.states.keys()].filter((key) => !graph.steps.some((s) => s.from === key));

const verdicts: Verdict[] = [
	...config.invariants.map((rule): Verdict => {
		const trace = broken.get(rule);
		const found = chartRun?.violations.filter((v) => v.rule === rule).map((v) => lastKey(v.trace)) ?? [];
		return { rule, kind: "invariant", trace, breaking: trace && new Set([lastKey(trace), ...found]) };
	}),
	...(config.checksDeadlock ? [{ rule: "deadlock", kind: "deadlock", trace: deadlock, breaking: deadlock && new Set(complete && !bounded ? deadEnds : [lastKey(deadlock)]) } satisfies Verdict] : []),
	...[...properties].map(([rule, trace]): Verdict => ({
		rule,
		kind: "property",
		trace,
		breaking: trace && trace.loop === undefined && !trace.stutters ? new Set([lastKey(trace)]) : undefined,
		initialOnly: (levels.get(rule) ?? TEMPORAL_LEVEL) < TEMPORAL_LEVEL,
	})),
];

const view: View = values.view ? await import(resolve(values.view)) : {};
let drawing;
try {
	drawing = draw(graph, verdicts, view, { title: typeof view.title === "string" ? view.title : module, distinct, complete, arrowBudget: Number(values.arrows) });
} catch (error) {
	if (error instanceof Refusal) fail(`the chart would mislead, so it is not drawn. ${error.message}`);
	throw error;
}
writeFileSync(join(out, "report.md"), drawing.report);
if (drawing.mermaid) writeFileSync(join(out, "chart.mmd"), drawing.mermaid);
console.log(drawing.report);
console.log(`Files: ${out}/report.md${drawing.mermaid ? `, ${out}/chart.mmd` : ""}, and each TLC run's output as tlc-*.out.`);
process.exit(verdicts.some((v) => v.trace) ? 1 : 0);
