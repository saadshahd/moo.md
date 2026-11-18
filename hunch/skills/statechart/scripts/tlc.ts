/**
 * Reads what TLC and SANY print, and writes the TLC config files a check runs on. Nothing here runs a process.
 */

export type Value = string | number | boolean | Value[] | { [key: string]: Value };
export type Vars = { [name: string]: Value };

/** One state a TLC trace passes through, and the action that led to it; the first has none. */
export type TraceState = { action: string | undefined; vars: Vars };

/** A path TLC printed: from a start state to where a rule breaks. A trace that loops back ends in
 * \`loop\`, the index it returns to; one that stutters ends in \`stutters\`. */
export type Trace = { states: TraceState[]; loop?: number; stutters?: boolean };

export type Violation = { rule: string | undefined; kind: "invariant" | "deadlock" | "property"; trace: Trace };

export type RunResult = { violations: Violation[]; distinct: number };

export type Config = { base: string; invariants: string[]; properties: string[]; checksDeadlock: boolean };

/** `value`, or a throw naming what was missing. */
export function must<T>(value: T | undefined, missing: string): T {
	if (value === undefined) throw new Error(missing);
	return value;
}

const KEYWORDS = ["CONSTANTS", "CONSTANT", "INIT", "NEXT", "SPECIFICATION", "INVARIANTS", "INVARIANT", "PROPERTIES", "PROPERTY", "ACTION_CONSTRAINTS", "ACTION_CONSTRAINT", "CONSTRAINTS", "CONSTRAINT", "SYMMETRY", "VIEW", "ALIAS", "POSTCONDITION", "CHECK_DEADLOCK"];
const SECTION = new RegExp(String.raw`\b(${KEYWORDS.join("|")})\b`, "g");
const withoutComments = (text: string) => text.replace(/\(\*[\s\S]*?\*\)/g, " ").replace(/\\\*.*$/gm, "");
const namesIn = (body: string) => body.split(/[\s,]+/).filter(Boolean);

/** A config split into the rules it checks and the rest, kept as written. */
export function readConfig(text: string): Config {
	const clean = withoutComments(text);
	const starts = [...clean.matchAll(SECTION)];
	const sections = starts.map((m, i) => ({ keyword: m[1], body: clean.slice(m.index + m[0].length, starts[i + 1]?.index ?? clean.length) }));
	const named = (...keywords: string[]) => sections.filter((s) => keywords.includes(s.keyword)).flatMap((s) => namesIn(s.body));
	const deadlock = sections.find((s) => s.keyword === "CHECK_DEADLOCK");
	return {
		base: sections
			.filter((s) => !["INVARIANT", "INVARIANTS", "PROPERTY", "PROPERTIES", "CHECK_DEADLOCK"].includes(s.keyword))
			.map((s) => (s.keyword + s.body).trim())
			.join("\n"),
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
	let at = 0;
	const fail = (what: string): never => {
		throw new Error(`cannot read the TLA+ value at ${at} (${what}): ${text.slice(0, 200)}`);
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
	const parsed = value();
	skip();
	if (at !== text.length) fail("text after the value");
	return parsed;
}

/** A state as TLC prints it: \`/\\ name = value\` lines, or one \`name = value\` for a single variable. */
export function parseState(text: string): Vars {
	const body = text.trim();
	const parts = body.startsWith("/\\ ") ? body.slice(3).split(/\n\/\\ /) : [body];
	return Object.fromEntries(
		parts.map((part) => {
			const pair = /^(\w+)\s*=\s*([\s\S]*)$/.exec(part.trim());
			if (!pair) throw new Error(`cannot read the TLC state line "${part}"`);
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
		if (!TRACE_HEAD.test(lines[i] ?? "")) throw new Error(`TLC printed "${head}" with no trace after it`);
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
		if (!known) throw new Error(`TLC printed an error this script cannot place:\n${lines.slice(i - 1, i + 8).join("\n")}`);
		violations.push({ rule: known[0].exec(line)?.[1], kind: known[1], trace: traceAfter(line) });
	}
	const counts = [...output.matchAll(/(\d+) distinct states? (?:found|generated)/g)].map((m) => Number(m[1]));
	return { violations, distinct: Math.max(0, ...counts) };
}

export type Step = { from: string; to: string; action: string };
export type Graph = { states: Map<string, { vars: Vars; start: boolean }>; steps: Step[] };

const unescapeDot = (s: string) => s.replace(/\\(.)/g, (_, c: string) => (c === "n" ? "\n" : c));

/** The state graph \`-dump dot,actionlabels\` writes, keyed by \`stateKey\`. Stuttering steps carry no
 * label and stay out. */
export function parseDot(dot: string): Graph {
	const ids = new Map<string, string>();
	const states = new Map<string, { vars: Vars; start: boolean }>();
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
	const keyOf = (id: string) => must(ids.get(id), `the TLC graph has a step to or from state ${id}, which it does not list`);
	return { states, steps: edges.map(([from, to, action]) => ({ from: keyOf(from), to: keyOf(to), action })) };
}

/** The graph of the given traces alone: what a chart draws when the model has too many states for all. */
export function pathGraph(traces: Trace[]): Graph {
	const states = new Map<string, { vars: Vars; start: boolean }>();
	const steps = new Map<string, Step>();
	for (const { states: path } of traces)
		path.forEach(({ vars, action }, i) => {
			const key = stateKey(vars);
			if (!states.has(key)) states.set(key, { vars, start: i === 0 });
			if (i > 0 && action !== undefined) {
				const step = { from: stateKey(path[i - 1].vars), to: key, action };
				steps.set(JSON.stringify(step), step);
			}
		});
	return { states, steps: [...steps.values()] };
}

/** Each operator's level as SANY's XML export gives it: 0 constant, 1 state, 2 action, 3 temporal. */
export function definitionLevels(xml: string): Map<string, number> {
	return new Map([...xml.matchAll(/<UserDefinedOpKind>(?:(?!<\/UserDefinedOpKind>)[\s\S])*?<level>(\d)<\/level><uniquename>([^<]+)<\/uniquename>/g)].map((m) => [m[2], Number(m[1])]));
}

export const TEMPORAL_LEVEL = 3;
