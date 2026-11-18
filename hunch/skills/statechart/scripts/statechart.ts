#!/usr/bin/env bun
/**
 * Checks each rule of a TLA+ spec with everystate, a TLC-compatible model checker, then draws the model's states as
 * a Mermaid statechart in the words a view module gives, with the path to each rule that breaks.
 *
 *   bun statechart.ts SPEC.tla [--config FILE] [--view FILE] [--out DIR] [--chart-states 500] [--arrows 20]
 *
 * everystate runs through bunx, so the command needs only bun.
 * Exits 0 when every rule holds, 1 when a rule breaks, 2 when it cannot check or draw.
 */
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { $ } from "bun";
import { draw, Refusal, type Verdict, type View } from "./chart.ts";
import { configText, definitionLevels, type Graph, parseDot, pathGraph, printedBreaks, readConfig, readRun, stateKey, TEMPORAL_LEVEL, type Trace, watchModule, withPaths } from "./tlc.ts";

const USAGE = "usage: statechart.ts SPEC.tla [--config FILE] [--view FILE] [--out DIR] [--chart-states N] [--arrows N]";
const ENGINE = ["bunx", "everystate@0.4.0"];
const VIOLATION_EXITS = new Set([10, 11, 12, 13]);

const fail = (message: string): never => {
	console.error(`statechart: ${message}`);
	process.exit(2);
};
process.on("uncaughtException", (error) => fail(error.stack ?? error.message));

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
const spec = resolve(positionals[0] ?? fail(USAGE));
const folder = dirname(spec);
const module = basename(spec, ".tla");
const config = readConfig(readFileSync(resolve(values.config ?? join(folder, `${module}.cfg`)), "utf8"));
const out = resolve(values.out ?? mkdtempSync(join(tmpdir(), `statechart-${module}-`)));
const work = mkdtempSync(join(tmpdir(), "statechart-run-"));
process.on("exit", () => rmSync(work, { recursive: true, force: true }));
mkdirSync(out, { recursive: true });

const tail = (text: string) => text.trim().split("\n").slice(-25).join("\n");

const sany = await $`${ENGINE} java -cp _ tla2sany.xml.XMLExporter -o -I ${folder} ${spec}`.cwd(folder).nothrow().quiet();
if (sany.exitCode !== 0) fail(`everystate cannot read ${spec}:\n${tail(sany.stdout.toString() + sany.stderr.toString())}`);
const levels = definitionLevels(sany.stdout.toString());
const initialOnly = new Set(config.properties.filter((rule) => (levels.get(rule) ?? fail(`SANY's export gives no level for the PROPERTY ${rule}, so it cannot tell whether ${rule} checks more than the start states.`)) < TEMPORAL_LEVEL));

/** One everystate run of `target` on `cfg` from `cwd`; its output is kept in the out folder. A run everystate could
 * not finish ends the command. */
async function check(name: string, cfg: string, flags: string[], { target = module, cwd = folder } = {}) {
	const cfgFile = join(work, `${name}.cfg`);
	writeFileSync(cfgFile, cfg);
	const run = await $`${ENGINE} -workers 1 -config ${cfgFile} ${flags} ${target}`.cwd(cwd).nothrow().quiet();
	const text = run.stdout.toString() + run.stderr.toString();
	writeFileSync(join(out, `everystate-${name}.out`), text);
	if (run.exitCode !== 0 && !VIOLATION_EXITS.has(run.exitCode)) fail(`everystate could not check ${spec} (exit ${run.exitCode}):\n${tail(text)}`);
	return { ...readRun(text), output: text };
}

const broken = new Map<string, Trace>();
let distinct = 0;
for (let remaining = config.invariants, k = 1; ; k++) {
	const run = await check(`invariants-${k}`, configText(config.base, { invariants: remaining }), ["-deadlock"]);
	distinct = Math.max(distinct, run.distinct);
	const [first] = run.violations;
	if (!first?.rule) break;
	broken.set(first.rule, first.trace);
	remaining = remaining.filter((rule) => rule !== first.rule);
}
const deadlock = config.checksDeadlock ? (await check("deadlock", configText(config.base, {}), [])).violations[0]?.trace : undefined;
const properties = new Map<string, Trace | undefined>();
for (const rule of config.properties) properties.set(rule, (await check(`property-${rule}`, configText(config.base, { properties: [rule] }), ["-deadlock"])).violations[0]?.trace);

/** Every state each broken invariant fails in, from one run of a module whose invariant prints them: a check names
 * only the first rule a state breaks. It runs on copies in the work folder, so nothing lands beside the spec. */
async function breakingStates(graph: Graph, graphDistinct: number) {
	const modules = readdirSync(folder).filter((name) => name.endsWith(".tla"));
	const [first] = graph.states.values();
	const variables = Object.keys(first.vars);
	const watch = watchModule(module, [...broken.keys()], variables, modules.flatMap((name) => [name, readFileSync(join(folder, name), "utf8")]));
	for (const name of modules) copyFileSync(join(folder, name), join(work, name));
	writeFileSync(join(work, `${watch.module}.tla`), watch.text);
	const run = await check("breaking", configText(config.base, { invariants: [watch.invariant] }), ["-deadlock"], { target: watch.module, cwd: work });
	if (run.distinct !== graphDistinct) fail(`the run that lists the states each rule breaks saw ${run.distinct} distinct states, but the state graph holds ${graphDistinct}.`);
	return printedBreaks(run.output, watch.marker, variables);
}

const complete = distinct <= Number(values["chart-states"]);
const lastKey = (trace: Trace) => stateKey(trace.states.at(-1)!.vars);
const paths = [...broken.values(), deadlock, ...properties.values()].filter((trace) => trace !== undefined);
const bounded = /\b(ACTION_)?CONSTRAINTS?\b/.test(config.base);
const chart = complete ? await check("chart", configText(config.base, {}), ["-deadlock", "-dump", "dot,actionlabels", join(work, "chart")]) : undefined;
const dumped = chart && parseDot(readFileSync(join(work, "chart.dot"), "utf8"));
const graph = !dumped ? pathGraph(paths) : bounded ? withPaths(dumped, paths) : dumped;
const breaking = chart && broken.size ? await breakingStates(graph, chart.distinct) : new Map<string, Set<string>>();
/** A check tests each rule on the states just past a constraint, which the state graph leaves out. */
const pastBound = new Map([...breaking].map(([rule, keys]) => [rule, [...keys].filter((key) => !graph.states.has(key)).length]));
if (!bounded && [...pastBound.values()].some(Boolean)) fail(`the run that lists the states each rule breaks printed states the state graph does not hold, with no constraint to explain them; see ${join(out, "everystate-breaking.out")}.`);
const deadEnds = [...graph.states.keys()].filter((key) => !graph.steps.some((s) => s.from === key));

const verdicts: Verdict[] = [
	...config.invariants.map((rule): Verdict => {
		const trace = broken.get(rule);
		return { rule, kind: "invariant", trace, breaking: trace && new Set([lastKey(trace), ...(breaking.get(rule) ?? [])]), pastBound: pastBound.get(rule) };
	}),
	...(config.checksDeadlock ? [{ rule: "deadlock", kind: "deadlock", trace: deadlock, breaking: deadlock && new Set(complete && !bounded ? deadEnds : [lastKey(deadlock)]) } satisfies Verdict] : []),
	...[...properties].map(([rule, trace]): Verdict => ({
		rule,
		kind: "property",
		trace,
		breaking: trace && trace.loop === undefined && !trace.stutters ? new Set([lastKey(trace)]) : undefined,
		initialOnly: initialOnly.has(rule),
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
console.log(`Files: ${out}/report.md${drawing.mermaid ? `, ${out}/chart.mmd` : ""}, and each everystate run's output as everystate-*.out.`);
process.exit(verdicts.some((v) => v.trace) ? 1 : 0);
