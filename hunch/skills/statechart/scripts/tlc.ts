/**
 * Reads what TLC and SANY print, in the formats everystate keeps, and writes the config files and the module a check
 * runs on. Nothing here runs a process.
 */

export type Value = string | number | boolean | Value[] | { [key: string]: Value };
export type Vars = { [name: string]: Value };

/** One state a TLC trace passes through, and the action that led to it; the first has none. */
export type TraceState = { action: string | undefined; vars: Vars };

/** A path TLC printed: from a start state to where a rule breaks. A trace that loops back ends in
 * \`loop\`, the index it returns to; one that stutters ends in \`stutters\`; one a bound cuts holds \`cut\`. */
export type Trace = { states: TraceState[]; loop?: number; stutters?: boolean; cut?: Cut };

/** Where a bound cuts a trace: `at` is the index of the first state the bounded model rejects, so the step into it is
 * cut, or the start when 0. `pastBound` holds when a replay proved that state lies past a CONSTRAINT, which leaves it
 * out of the states a check counts. */
export type Cut = { at: number; pastBound: boolean };

export type Violation = { rule: string | undefined; kind: "invariant" | "deadlock" | "property"; trace: Trace };

export type RunResult = { violations: Violation[]; distinct: number };

/** A config's model, `base`, and the rules it checks. `stateBound` is the model with only its CONSTRAINT bounds, when it has one. */
export type Config = { base: string; stateBound: string | undefined; invariants: string[]; properties: string[]; checksDeadlock: boolean };

/** `value`, or a throw naming what was missing. */
export function must<T>(value: T | undefined, missing: string): T {
	if (value === undefined) throw new Error(missing);
	return value;
}

const KEYWORDS = ["CONSTANTS", "CONSTANT", "INIT", "NEXT", "SPECIFICATION", "INVARIANTS", "INVARIANT", "PROPERTIES", "PROPERTY", "ACTION_CONSTRAINTS", "ACTION_CONSTRAINT", "CONSTRAINTS", "CONSTRAINT", "SYMMETRY", "VIEW", "ALIAS", "POSTCONDITION", "CHECK_DEADLOCK"];
const SECTION = new RegExp(String.raw`\b(${KEYWORDS.join("|")})\b`, "g");
const withoutComments = (text: string) => text.replace(/\(\*[\s\S]*?\*\)/g, " ").replace(/\\\*.*$/gm, "");
const namesIn = (body: string) => body.split(/[\s,]+/).filter(Boolean);
const OUTSIDE_THE_MODEL = ["INVARIANT", "INVARIANTS", "PROPERTY", "PROPERTIES", "CHECK_DEADLOCK", "ALIAS"];

/** A config split into the rules it checks and the model, kept as written. The model leaves out an ALIAS, which changes
 * only how a run prints a trace's states: the chart reads the model's own variables. */
export function readConfig(text: string): Config {
	const clean = withoutComments(text);
	const starts = [...clean.matchAll(SECTION)];
	const sections = starts.map((m, i) => ({ keyword: m[1], body: clean.slice(m.index + m[0].length, starts[i + 1]?.index ?? clean.length) }));
	const named = (...keywords: string[]) => sections.filter((s) => keywords.includes(s.keyword)).flatMap((s) => namesIn(s.body));
	const deadlock = sections.find((s) => s.keyword === "CHECK_DEADLOCK");
	const without = (keywords: string[]) =>
		sections
			.filter((s) => !keywords.includes(s.keyword))
			.map((s) => (s.keyword + s.body).trim())
			.join("\n");
	return {
		base: without(OUTSIDE_THE_MODEL),
		stateBound: named("CONSTRAINT", "CONSTRAINTS").length ? without([...OUTSIDE_THE_MODEL, "ACTION_CONSTRAINT", "ACTION_CONSTRAINTS"]) : undefined,
		invariants: named("INVARIANT", "INVARIANTS"),
		properties: named("PROPERTY", "PROPERTIES"),
		checksDeadlock: deadlock === undefined || deadlock.body.trim() !== "FALSE",
	};
}

/** A config that checks only the rules given, on the model \`base\` describes. */
export const configText = (base: string, rules: { invariants?: string[]; properties?: string[] }) =>
	[base, rules.invariants?.length ? `INVARIANT ${rules.invariants.join(" ")}` : "", rules.properties?.length ? `PROPERTY ${rules.properties.join(" ")}` : ""].filter(Boolean).join("\n") + "\n";

/** A TLA+ value as TLC prints it. A set is an array; a record, a sequence or a function is an object
 * keyed by its domain, so a sequence's first element is at key 1, as in TLA+. */
export function parseValue(text: string): Value {
	const { value, end } = valueAt(text, 0);
	if (text.slice(end).trim() !== "") throw new Error(`cannot read the TLA+ value at ${end} (text after the value): ${text.slice(0, 200)}`);
	return value;
}

/** The value that starts at `start` in `text`, read as `parseValue` reads it, and the index just past it. */
function valueAt(text: string, start: number): { value: Value; end: number } {
	let at = start;
	const fail = (what: string): never => {
		throw new Error(`cannot read the TLA+ value at ${at} (${what}): ${text.slice(start, start + 200)}`);
	};
	const skip = () => {
		while (at < text.length && /\s/.test(text[at])) at++;
	};
	const eat = (token: string) => {
		skip();
		if (!text.startsWith(token, at)) fail(`expected ${token}`);
		at += token.length;
	};
	const sees = (token: string) => {
		skip();
		return text.startsWith(token, at);
	};
	const keyOf = (v: Value) => (typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? String(v) : JSON.stringify(v));
	const listUntil = (close: string): Value[] => {
		const items: Value[] = [];
		while (!sees(close)) {
			items.push(value());
			if (!sees(close)) eat(",");
		}
		eat(close);
		return items;
	};
	const value = (): Value => {
		skip();
		const rest = text.slice(at);
		if (sees("<<")) {
			eat("<<");
			return Object.fromEntries(listUntil(">>").map((v, i) => [String(i + 1), v]));
		}
		if (sees("{")) {
			eat("{");
			return listUntil("}");
		}
		if (sees("[")) {
			eat("[");
			const record: { [key: string]: Value } = {};
			while (!sees("]")) {
				const field = /^\s*(\w+)\s*\|->/.exec(text.slice(at)) ?? fail("expected a record field");
				at += field[0].length;
				record[field[1]] = value();
				if (!sees("]")) eat(",");
			}
			eat("]");
			return record;
		}
		if (sees("(")) {
			eat("(");
			const fn: { [key: string]: Value } = {};
			for (;;) {
				const key = value();
				eat(":>");
				fn[keyOf(key)] = value();
				if (!sees("@@")) break;
				eat("@@");
			}
			eat(")");
			return fn;
		}
		const string = /^"((?:[^"\\]|\\.)*)"/.exec(rest);
		if (string) {
			at += string[0].length;
			return string[1].replace(/\\(.)/g, (_, c: string) => (c === "n" ? "\n" : c === "t" ? "\t" : c));
		}
		const number = /^-?\d+/.exec(rest);
		if (number) {
			at += number[0].length;
			return Number(number[0]);
		}
		const word = /^[A-Za-z_]\w*/.exec(rest) ?? fail("expected a value");
		at += word[0].length;
		return word[0] === "TRUE" ? true : word[0] === "FALSE" ? false : word[0];
	};
	return { value: value(), end: at };
}

/** A state as TLC prints it: \`/\\ name = value\` lines, or one \`name = value\` for a single variable. */
export function parseState(text: string): Vars {
	const body = text.trim();
	const parts = body.startsWith("/\\ ") ? body.slice(3).split(/\n\/\\ /) : [body];
	return Object.fromEntries(
		parts.map((part) => {
			const pair = /^(\w+)\s*=\s*([\s\S]*)$/.exec(part.trim());
			if (!pair) throw new Error(`cannot read the state line "${part}" everystate printed`);
			return [pair[1], parseValue(pair[2])];
		}),
	);
}

/** One key per state, the same however TLC wrapped its lines. */
export const stateKey = (vars: Vars) => JSON.stringify(vars);

const VIOLATION: [RegExp, Violation["kind"]][] = [
	[/^Error: Invariant (\S+) is violated(?: by the initial state:|\.)$/, "invariant"],
	[/^Error: (?:Action property|Property) (\S+) is violated(?: by the initial state:|\.)$/, "property"],
	[/^Error: Temporal properties were violated\.$/, "property"],
	[/^Error: Deadlock reached\.$/, "deadlock"],
];
const TRACE_HEAD = /^Error: (?:The behavior up to this point is|The following behavior constitutes a counter-example):$/;
const STATE_HEAD = /^State (\d+): (?:<(\S+)[^>]*>|(Stuttering))$/;
const BACK_TO = /^Back to state (\d+): <(\S+)/;

/** What one TLC run found: each rule that broke with its path, and how many distinct states it saw.
 * Throws on an \`Error:\` line it cannot place, so a violation is never read as a pass. */
export function readRun(output: string): RunResult {
	const lines = output.split("\n");
	const violations: Violation[] = [];
	let i = 0;
	const stateLines = () => {
		const taken: string[] = [];
		while (i < lines.length && lines[i].trim() !== "" && !STATE_HEAD.test(lines[i]) && !BACK_TO.test(lines[i]) && !lines[i].startsWith("Error:")) taken.push(lines[i++]);
		return parseState(taken.join("\n"));
	};
	const traceAfter = (head: string): Trace => {
		if (head.endsWith("by the initial state:")) return { states: [{ action: undefined, vars: stateLines() }] };
		while (i < lines.length && lines[i].trim() === "") i++;
		if (!TRACE_HEAD.test(lines[i] ?? "")) throw new Error(`everystate printed "${head}" with no trace after it`);
		i++;
		const trace: Trace = { states: [] };
		while (i < lines.length) {
			while (i < lines.length && lines[i].trim() === "") i++;
			const back = BACK_TO.exec(lines[i] ?? "");
			if (back) {
				i++;
				return { ...trace, loop: Number(back[1]) - 1, states: [...trace.states, { action: back[2], vars: trace.states[Number(back[1]) - 1].vars }] };
			}
			const state = STATE_HEAD.exec(lines[i] ?? "");
			if (!state) return trace;
			i++;
			if (state[3]) return { ...trace, stutters: true };
			trace.states.push({ action: state[1] === "1" ? undefined : state[2], vars: stateLines() });
		}
		return trace;
	};
	while (i < lines.length) {
		const line = lines[i++];
		if (!line.startsWith("Error:")) continue;
		const known = VIOLATION.find(([re]) => re.test(line));
		if (!known) throw new Error(`everystate printed an error this script cannot place:\n${lines.slice(i - 1, i + 8).join("\n")}`);
		violations.push({ rule: known[0].exec(line)?.[1], kind: known[1], trace: traceAfter(line) });
	}
	const counts = [...output.matchAll(/(\d+) distinct states? (?:found|generated)/g)].map((m) => Number(m[1]));
	return { violations, distinct: Math.max(0, ...counts) };
}

/** One step between two states; `cut` marks one a bound cuts. */
export type Step = { from: string; to: string; action: string; cut?: boolean };
/** A state of a graph; one marked `pastBound` lies past a constraint. */
export type GraphState = { vars: Vars; start: boolean; pastBound?: boolean };
export type Graph = { states: Map<string, GraphState>; steps: Step[] };

export const stepId = ({ from, to, action }: Step) => `${from}|${to}|${action}`;

const unescapeDot = (s: string) => s.replace(/\\(.)/g, (_, c: string) => (c === "n" ? "\n" : c));

/** The state graph \`-dump dot,actionlabels\` writes, keyed by \`stateKey\`. Stuttering steps carry no
 * label and stay out. */
export function parseDot(dot: string): Graph {
	const ids = new Map<string, string>();
	const states = new Map<string, GraphState>();
	const edges: [string, string, string][] = [];
	for (const line of dot.split("\n")) {
		const node = /^(-?\d+) \[label="((?:[^"\\]|\\.)*)"(,style = filled)?/.exec(line);
		if (node) {
			const vars = parseState(unescapeDot(node[2]));
			ids.set(node[1], stateKey(vars));
			states.set(stateKey(vars), { vars, start: node[3] !== undefined });
			continue;
		}
		const edge = /^(-?\d+) -> (-?\d+) \[label="([^"]*)"/.exec(line);
		if (edge) edges.push([edge[1], edge[2], edge[3]]);
	}
	const keyOf = (id: string) => must(ids.get(id), `the state graph everystate wrote has a step to or from state ${id}, which it does not list`);
	return { states, steps: edges.map(([from, to, action]) => ({ from: keyOf(from), to: keyOf(to), action })) };
}

/** Each step a trace takes, the step back into its loop among them, with the step its bound cuts marked `cut`. */
export const traceSteps = ({ states, cut }: Trace): Step[] =>
	states.slice(1).flatMap(({ action, vars }, i) => (action === undefined ? [] : [{ from: stateKey(states[i].vars), to: stateKey(vars), action, cut: i + 1 === cut?.at }]));

/** The graph of the given traces alone: what a chart draws when the model has too many states for all. A state a
 * replay proved past a CONSTRAINT is marked `pastBound`. */
export function pathGraph(traces: Trace[]): Graph {
	const states = new Map<string, GraphState>();
	const steps = new Map<string, Step>();
	for (const trace of traces) {
		trace.states.forEach(({ vars }, i) => {
			const key = stateKey(vars);
			if (!states.has(key)) states.set(key, { vars, start: i === 0, pastBound: i === trace.cut?.at && trace.cut.pastBound });
		});
		for (const step of traceSteps(trace)) steps.set(stepId(step), step);
	}
	return { states, steps: [...steps.values()] };
}

/** The state graph a check dumped, with what `traces` add under a bound: each step the bound cuts, which the dump
 * leaves out, and each state of theirs the dump lacks. A check still tests each rule on the states just past a
 * constraint, so a path can end on one: each state the dump lacks is marked `pastBound`. */
export function withPaths(dump: Graph, traces: Trace[]): Graph {
	const paths = pathGraph(traces);
	const pastBound = [...paths.states].filter(([key]) => !dump.states.has(key)).map(([key, state]): [string, GraphState] => [key, { ...state, pastBound: true }]);
	return { states: new Map([...dump.states, ...pastBound]), steps: [...dump.steps, ...paths.steps.filter((step) => step.cut)] };
}

/** A trace as the observations `everystate conform` reads: each state's values, with no action named. */
export const traceObservations = ({ states }: Trace) => JSON.stringify(states.map(({ vars }) => ({ state: vars })));

/** The index in a trace's states of the first one an `everystate conform -json` run rejects, 0 for the start, or
 * undefined when the trace conforms. It reads only `status` and `failed.index`, which counts from 1: conform's hints
 * call an ACTION_CONSTRAINT "a CONSTRAINT". */
export function rejectedState(output: string): number | undefined {
	const { status, failed } = JSON.parse(output) as { status?: string; failed?: { index?: number } };
	if (status === "conforms") return undefined;
	const index = status === "mismatch" ? failed?.index : undefined;
	if (index === undefined || !Number.isInteger(index) || index < 1) throw new Error(`everystate conform answered neither "conforms" nor a mismatch at an observation: ${output.slice(0, 300)}`);
	return index - 1;
}

/** Each operator's level as SANY's XML export gives it: 0 constant, 1 state, 2 action, 3 temporal. SANY writes an
 * operator's level before its name and everystate after it; both come before its body, whose expressions carry
 * levels of their own. */
export function definitionLevels(xml: string): Map<string, number> {
	const heads = xml.split("<UserDefinedOpKind>").slice(1).map((entry) => entry.split(/<body>|<\/UserDefinedOpKind>/)[0]);
	return new Map(
		heads.flatMap((head): [string, number][] => {
			const name = /<uniquename>([^<]+)<\/uniquename>/.exec(head);
			const level = /<level>(\d)<\/level>/.exec(head);
			return name && level ? [[name[1], Number(level[1])]] : [];
		}),
	);
}

export const TEMPORAL_LEVEL = 3;

const unusedWord = (sources: string[], base: string, n = 1): string => {
	const word = n === 1 ? base : `${base}${n}`;
	return sources.some((source) => source.includes(word)) ? unusedWord(sources, base, n + 1) : word;
};

/** A module that EXTENDS `spec` and TLC, whose one invariant always holds and prints
 * `<<marker, rule, <<values>>>>` for each of `rules` a state breaks, its values in the order of `variables`.
 * Its module name, invariant name and marker hold a word no text in `sources` contains, so none collides with the
 * spec's own. */
export function watchModule(spec: string, rules: string[], variables: string[], sources: string[]) {
	const marker = unusedWord(sources, "Statechart");
	const names = { module: `${marker}Breaks`, invariant: `${marker}Watch`, marker };
	return {
		...names,
		text: [
			`---- MODULE ${names.module} ----`,
			`EXTENDS ${spec}, TLC`,
			`${names.invariant} ==`,
			...rules.map((rule) => `  /\\ (~(${rule}) => PrintT(<<"${marker}", "${rule}", <<${variables.join(", ")}>>>>))`),
			"====",
		].join("\n") + "\n",
	};
}

/** The states a run of `watchModule` printed as breaking each rule, keyed by `stateKey` with the printed values
 * named in the order of `variables`. Java TLC wraps a long tuple across lines; everystate prints it on one. */
export function printedBreaks(output: string, marker: string, variables: string[]): Map<string, Set<string>> {
	const printed = [...output.matchAll(new RegExp(String.raw`^<<\s*"${marker}"`, "gm"))].map(({ index }) => {
		const { 2: rule, 3: values } = valueAt(output, index).value as { 2: string; 3: { [key: string]: Value } };
		return { rule, key: stateKey(Object.fromEntries(variables.map((name, i) => [name, values[i + 1]]))) };
	});
	return new Map([...Map.groupBy(printed, ({ rule }) => rule)].map(([rule, found]) => [rule, new Set(found.map(({ key }) => key))]));
}
