import { describe, expect, test } from "claude-code/testing";
import { draw, Refusal, type Verdict, type View } from "./chart.ts";
import { configText, definitionLevels, parseDot, parseValue, pathGraph, readConfig, readRun, stateKey, type Graph, type Trace, type Vars } from "./tlc.ts";

const COUNT_CONTINUED = `Error: Invariant Small is violated.
Error: The behavior up to this point is:
State 1: <Initial predicate>
/\\ seen = {}
/\\ n = 0

State 2: <Up line 5, col 7 to line 5, col 50 of module Count>
/\\ seen = {0}
/\\ n = 1

Error: Invariant Small is violated.
Error: The behavior up to this point is:
State 1: <Initial predicate>
/\\ seen = {}
/\\ n = 0

State 2: <Up line 5, col 7 to line 5, col 50 of module Count>
/\\ seen = {0}
/\\ n = 1

State 3: <Up line 5, col 7 to line 5, col 50 of module Count>
/\\ seen = {0, 1}
/\\ n = 2

3 states generated, 3 distinct states found, 0 states left on queue.`;

const INITIAL = `Error: Invariant Never is violated by the initial state:
phase = "checking"`;

const LASSO = `Error: Temporal properties were violated.

Error: The following behavior constitutes a counter-example:

State 1: <Initial predicate>
phase = "checking"

State 2: <ChecksFail line 6, col 15 to line 6, col 53 of module Loop>
phase = "fixing"

Back to state 1: <FixDone line 7, col 12 to line 7, col 50 of module Loop>

5 states generated, 3 distinct states found, 0 states left on queue.`;

const STUTTER = `Error: Temporal properties were violated.

Error: The following behavior constitutes a counter-example:

State 1: <Initial predicate>
phase = "checking"

State 2: Stuttering
5 states generated, 3 distinct states found, 0 states left on queue.`;

const DEADLOCK = `Error: Deadlock reached.
Error: The behavior up to this point is:
State 1: <Initial predicate>
/\\ tries = 0
/\\ phase = "idle"

State 2: <YouPay line 6, col 11 to line 6, col 64 of module Pay>
/\\ tries = 0
/\\ phase = "paying"

State 3: <Succeeds line 8, col 13 to line 8, col 66 of module Pay>
/\\ tries = 0
/\\ phase = "paid"

5 states generated, 5 distinct states found, 1 states left on queue.`;

const PAY_DOT = `strict digraph DiskGraph {
nodesep=0.35;
subgraph cluster_graph {
color="white";
7937945059421937079 [label="/\\\\ tries = 0\\n/\\\\ phase = \\"idle\\"",style = filled]
7937945059421937079 -> -4005091659966787851 [label="YouPay",color="black",fontcolor="black"];
-4005091659966787851 [label="/\\\\ tries = 0\\n/\\\\ phase = \\"paying\\""];
7937945059421937079 -> 7937945059421937079 [style="dashed"];
-4005091659966787851 -> -4924633812022178134 [label="Fails",color="black",fontcolor="black"];
-4924633812022178134 [label="/\\\\ tries = 1\\n/\\\\ phase = \\"idle\\""];
}
}`;

const SANY_XML = `<entry><UID>337</UID><UserDefinedOpKind><location><column><begin>1</begin><end>40</end></column><line><begin>14</begin><end>14</end></line><filename>Pay</filename></location><level>3</level><uniquename>Ends</uniquename><entry><UID>341</UID><UserDefinedOpKind><location><column><begin>1</begin><end>26</end></column><line><begin>15</begin><end>15</end></line><filename>Pay</filename></location><level>1</level><uniquename>InitOnly</uniquename>`;

describe("readConfig", () => {
	test("splits the rules a config checks from the rest, kept as written", () => {
		const config = readConfig("SPECIFICATION Spec \\* the model\nCONSTANT N = 3\nINVARIANT TypeOK, Safe\n(* off *) PROPERTY Live\nCHECK_DEADLOCK FALSE\n");
		expect(config).toEqual({ base: "SPECIFICATION Spec\nCONSTANT N = 3", invariants: ["TypeOK", "Safe"], properties: ["Live"], checksDeadlock: false });
		expect(configText(config.base, { invariants: ["Safe"] })).toBe("SPECIFICATION Spec\nCONSTANT N = 3\nINVARIANT Safe\n");
	});
});

test("parseValue reads sets as arrays, and records, sequences and functions as objects keyed by their domain", () => {
	expect(parseValue('[pc |-> <<"a", -1>>, done |-> {TRUE, p1}, owner |-> (1 :> "x\\"y" @@ 2 :> <<>>)]')).toEqual({ pc: { 1: "a", 2: -1 }, done: [true, "p1"], owner: { 1: 'x"y', 2: {} } });
});

describe("readRun", () => {
	test("reads every violation -continue prints, the first one the shortest, and the distinct states", () => {
		const run = readRun(COUNT_CONTINUED);
		expect(run.distinct).toBe(3);
		expect(run.violations.map((v) => [v.rule, v.trace.states.length])).toEqual([["Small", 2], ["Small", 3]]);
		expect(run.violations[1].trace.states[2]).toEqual({ action: "Up", vars: { seen: [0, 1], n: 2 } });
	});
	test("reads a rule broken by a start state, and a deadlock", () => {
		expect(readRun(INITIAL).violations).toEqual([{ rule: "Never", kind: "invariant", trace: { states: [{ action: undefined, vars: { phase: "checking" } }] } }]);
		expect(readRun(DEADLOCK).violations.map((v) => [v.kind, v.trace.states.at(-1)])).toEqual([["deadlock", { action: "Succeeds", vars: { tries: 0, phase: "paid" } }]]);
	});
	test("reads a temporal counterexample that loops back, or stutters", () => {
		expect(readRun(LASSO).violations[0].trace).toEqual({ loop: 0, states: [{ action: undefined, vars: { phase: "checking" } }, { action: "ChecksFail", vars: { phase: "fixing" } }, { action: "FixDone", vars: { phase: "checking" } }] });
		expect(readRun(STUTTER).violations[0].trace).toEqual({ stutters: true, states: [{ action: undefined, vars: { phase: "checking" } }] });
	});
	test("throws on an error it cannot place, so no failure reads as a pass", () => {
		expect(() => readRun("Error: The configuration file cannot specify both INIT/NEXT and SPECIFICATION fields.")).toThrow(/cannot place/);
	});
});

test("parseDot keeps labelled steps and start states, and drops stuttering", () => {
	const graph = parseDot(PAY_DOT);
	expect([...graph.states.values()].map((s) => [s.vars.phase, s.start])).toEqual([["idle", true], ["paying", false], ["idle", false]]);
	expect(graph.steps.map((s) => s.action)).toEqual(["YouPay", "Fails"]);
});

test("pathGraph draws a trace's steps, the step back into its loop among them", () => {
	const graph = pathGraph([readRun(LASSO).violations[0].trace]);
	expect(graph.states.size).toBe(2);
	expect(graph.steps.map((s) => s.action)).toEqual(["ChecksFail", "FixDone"]);
});

test("definitionLevels reads each definition's level from SANY's XML", () => {
	expect([...definitionLevels(SANY_XML)]).toEqual([["Ends", 3], ["InitOnly", 1]]);
});

const at = (phase: string, n = 0): Vars => ({ phase, n });
const graphOf = (starts: Vars[], moves: [Vars, string, Vars][]): Graph => {
	const states = new Map([...starts, ...moves.flatMap(([from, , to]) => [from, to])].map((vars) => [stateKey(vars), { vars, start: starts.some((s) => stateKey(s) === stateKey(vars)) }]));
	return { states, steps: moves.map(([from, action, to]) => ({ from: stateKey(from), to: stateKey(to), action })) };
};
const traceOf = (...path: [string | undefined, Vars][]): Trace => ({ states: path.map(([action, vars]) => ({ action, vars })) });
const settings = { title: "Pay", distinct: 4, complete: true, arrowBudget: 20 };
const byPhase: View = { state: (v) => String(v.phase) };

const PAY = graphOf([at("idle")], [[at("idle"), "Pay", at("paying")], [at("paying"), "Decline", at("idle", 1)], [at("idle", 1), "Pay", at("paying", 1)], [at("paying", 1), "Accept", at("paid", 1)], [at("paying"), "Accept", at("paid")]]);
const PAID_TWICE: Verdict = { rule: "PaysOnce", kind: "invariant", trace: traceOf([undefined, at("idle")], ["Pay", at("paying")], ["Decline", at("idle", 1)], ["Pay", at("paying", 1)], ["Accept", at("paid", 1)]), breaking: new Set([stateKey(at("paid", 1))]) };

describe("draw refuses a view that would make the chart claim what the model does not do", () => {
	test("a state() answer that is empty or leaks undefined or NaN", () => {
		expect(() => draw(PAY, [], { state: () => undefined }, settings)).toThrow(Refusal);
		expect(() => draw(PAY, [], { state: (v) => `Paying ${Number(v.missing)}` }, settings)).toThrow(/NaN/);
	});
	test("a hidden step on the path to a bug", () => {
		expect(() => draw(PAY, [PAID_TWICE], { ...byPhase, step: (a) => (a === "Decline" ? null : a) }, settings)).toThrow(/on the path to the PaysOnce bug/);
	});
	test("a hidden step out of a bug's loop", () => {
		const graph = graphOf([at("checking")], [[at("checking"), "Fail", at("fixing")], [at("fixing"), "Fixed", at("checking")], [at("checking"), "Pass", at("done")]]);
		const loop: Verdict = { rule: "Ends", kind: "property", trace: { ...traceOf([undefined, at("checking")], ["Fail", at("fixing")], ["Fixed", at("checking")]), loop: 0 } };
		expect(() => draw(graph, [loop], { ...byPhase, step: (a) => (a === "Pass" ? null : a) }, settings)).toThrow(/leaves the loop of the Ends bug/);
	});
	test("an arrow the loop of a bug cannot take, drawn out of a state the loop passes", () => {
		const graph = graphOf([at("checking")], [[at("checking"), "Fail", at("fixing")], [at("fixing"), "Fixed", at("checking")], [at("checking"), "Skip", at("checking", 1)], [at("checking", 1), "Pass", at("done")]]);
		const loop: Verdict = { rule: "Ends", kind: "property", trace: { ...traceOf([undefined, at("checking")], ["Fail", at("fixing")], ["Fixed", at("checking")]), loop: 0 } };
		expect(() => draw(graph, [loop], byPhase, settings)).toThrow(/the loop cannot take it there/);
	});
	test("hiding some steps of an arrow and drawing others", () => {
		expect(() => draw(PAY, [], { ...byPhase, step: (a, from) => (a === "Accept" && from.n === 1 ? null : a) }, settings)).toThrow(/Hide all of an arrow or none/);
	});
	test("hiding every arrow out of a state that has steps out", () => {
		expect(() => draw(PAY, [], { ...byPhase, step: (a) => (a === "Pay" ? null : a) }, settings)).toThrow(/"idle" has steps out in the model, but the chart hides every one/);
	});
	test("a state no drawn arrow reaches from a start", () => {
		const graph = graphOf([at("idle")], [[at("idle"), "Pay", at("paying")], [at("paying"), "Decline", at("idle")], [at("paying"), "Refund", at("refunded")]]);
		expect(() => draw(graph, [], { ...byPhase, step: (a) => (a === "Refund" ? null : a) }, settings)).toThrow(/No drawn arrow leads from a start state to "refunded"/);
	});
	test("one label over states that break different rules", () => {
		const other: Verdict = { rule: "Receipt", kind: "invariant", trace: traceOf([undefined, at("idle")], ["Pay", at("paying")], ["Accept", at("paid")]), breaking: new Set([stateKey(at("paid"))]) };
		expect(() => draw(PAY, [PAID_TWICE, other], byPhase, settings)).toThrow(/merges states that break different rules/);
	});
});

describe("draw", () => {
	test("marks a state may-break when only some states behind its label break the rule", () => {
		const { mermaid, report } = draw(PAY, [PAID_TWICE], byPhase, settings);
		expect(mermaid).toContain("s2 : paid\n");
		expect(mermaid).toContain("class s2 mayBreak");
		expect(report).toContain("- paid: may break PaysOnce");
	});
	test("gives each broken rule's shortest path, numbered in the reader's words", () => {
		const { report } = draw(PAY, [PAID_TWICE], { ...byPhase, step: (a) => ({ Pay: "you press pay", Decline: "the card is declined", Accept: "the bank accepts" })[a] }, settings);
		expect(report).toContain("The shortest path has 4 steps:\n\n0. idle (start)\n1. you press pay → paying\n2. the card is declined → idle\n3. you press pay → paying\n4. the bank accepts → paid");
	});
	test("says a property with no temporal operator checks only the start states", () => {
		const { report } = draw(PAY, [{ rule: "StartsIdle", kind: "property", initialOnly: true }], byPhase, settings);
		expect(report).toContain("| StartsIdle | holds, checking only the start states");
	});
	test("draws no chart for a model too large to draw when no rule breaks", () => {
		expect(draw(PAY, [], byPhase, { ...settings, complete: false }).mermaid).toBeUndefined();
	});
});
