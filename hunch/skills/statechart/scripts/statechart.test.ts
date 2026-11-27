import { describe, expect, test } from "claude-code/testing";
import { draw, type Drawing, Refusal, type Verdict, type View } from "./chart.ts";
import { configText, definitionLevels, parseDot, parseValue, pathGraph, printedBreaks, readConfig, readRun, rejectedState, stateKey, traceObservations, traceSteps, watchModule, withPaths, type Graph, type Step, type Trace, type Vars } from "./tlc.ts";

const COUNT = `Error: Invariant Small is violated.
Error: The behavior up to this point is:
State 1: <Initial predicate>
/\\ seen = {}
/\\ n = 0

State 2: <Up line 5, col 7 to line 5, col 50 of module Count>
/\\ seen = {0}
/\\ n = 1

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

const SANY_XML = `<UserDefinedOpKind><location><column><begin>1</begin><end>17</end></column><line><begin>13</begin><end>13</end></line><filename>Count</filename></location><level>3</level><uniquename>Ends</uniquename><arity>0</arity><body><OpApplNode><location><column><begin>9</begin><end>17</end></column><line><begin>13</begin><end>13</end></line><filename>Count</filename></location><level>3</level><operator><BuiltInKindRef><UID>63</UID></BuiltInKindRef></operator><operands><OpApplNode><location><column><begin>12</begin><end>16</end></column><line><begin>13</begin><end>13</end></line><filename>Count</filename></location><level>1</level><operator><BuiltInKindRef><UID>4</UID></BuiltInKindRef></operator><operands><OpApplNode><location><column><begin>12</begin><end>12</end></column><line><begin>13</begin><end>13</end></line><filename>Count</filename></location><level>1</level><operator><OpDeclNodeRef><UID>230</UID></OpDeclNodeRef></operator><operands/></OpApplNode><NumeralNode><location><column><begin>16</begin><end>16</end></column><line><begin>13</begin><end>13</end></line><filename>Count</filename></location><level>0</level><IntValue>3</IntValue></NumeralNode></operands></OpApplNode></operands></OpApplNode></body><params/></UserDefinedOpKind><UserDefinedOpKind><uniquename>StateProp</uniquename><level>1</level><arity>0</arity></UserDefinedOpKind>`;

const PRINTED_BY_TLC = `Finished computing initial states: 1 distinct state generated at 2026-11-18 21:08:21.
<< "Statechart",
   "Small",
   << "checking-the-very-long-phase-name",
      <<"alpha-entry", "beta-entry", "gamma-entry", "delta-entry">>,
      [fixRuns |-> 1, reviewRuns |-> 0, planRuns |-> 0, tokens |-> 0] >> >>
<< "Statechart",
   "Small",
   << "checking-the-very-long-phase-name",
      <<"alpha-entry", "beta-entry", "gamma-entry", "delta-entry">>,
      [fixRuns |-> 2, reviewRuns |-> 0, planRuns |-> 0, tokens |-> 0] >> >>
Model checking completed. No error has been found.`;

const PRINTED_BY_EVERYSTATE = `Finished computing initial states: 1 distinct state generated at 2026-11-18 21:08:21.
<<"Statechart", "Small", <<"checking-the-very-long-phase-name", <<"alpha-entry", "beta-entry", "gamma-entry", "delta-entry">>, [fixRuns |-> 1, reviewRuns |-> 0, planRuns |-> 0, tokens |-> 0]>>>>
<<"Statechart", "Small", <<"checking-the-very-long-phase-name", <<"alpha-entry", "beta-entry", "gamma-entry", "delta-entry">>, [fixRuns |-> 2, reviewRuns |-> 0, planRuns |-> 0, tokens |-> 0]>>>>
Model checking completed. No error has been found.`;

describe("readConfig", () => {
	test("splits the rules a config checks from the rest, kept as written, and gives the model with only its CONSTRAINT bounds", () => {
		const config = readConfig("SPECIFICATION Spec \\* the model\nCONSTANT N = 3\nINVARIANT TypeOK, Safe\n(* off *) PROPERTY Live\nCHECK_DEADLOCK FALSE\n");
		expect(config).toEqual({ base: "SPECIFICATION Spec\nCONSTANT N = 3", stateBound: undefined, invariants: ["TypeOK", "Safe"], properties: ["Live"], checksDeadlock: false });
		expect(configText(config.base, { invariants: ["Safe"] })).toBe("SPECIFICATION Spec\nCONSTANT N = 3\nINVARIANT Safe\n");
		const bounded = readConfig("SPECIFICATION Spec\nCONSTRAINT Low\nACTION_CONSTRAINT Small\nINVARIANT Safe\n");
		expect([bounded.base, bounded.stateBound]).toEqual(["SPECIFICATION Spec\nCONSTRAINT Low\nACTION_CONSTRAINT Small", "SPECIFICATION Spec\nCONSTRAINT Low"]);
	});
	test("leaves out the ALIAS, which changes only how a run prints a trace's states, from the model and from its CONSTRAINT bounds", () => {
		const config = readConfig("SPECIFICATION Spec\nALIAS Shifted\nCONSTRAINT Low\nACTION_CONSTRAINT Small\nINVARIANT Safe\n");
		expect([config.base, config.stateBound]).toEqual(["SPECIFICATION Spec\nCONSTRAINT Low\nACTION_CONSTRAINT Small", "SPECIFICATION Spec\nCONSTRAINT Low"]);
	});
});

test("parseValue reads sets as arrays, and records, sequences and functions as objects keyed by their domain", () => {
	expect(parseValue('[pc |-> <<"a", -1>>, done |-> {TRUE, p1}, owner |-> (1 :> "x\\"y" @@ 2 :> <<>>)]')).toEqual({ pc: { 1: "a", 2: -1 }, done: [true, "p1"], owner: { 1: 'x"y', 2: {} } });
});

describe("readRun", () => {
	test("reads a broken invariant's path and the distinct states", () => {
		expect(readRun(COUNT)).toEqual({ distinct: 3, violations: [{ rule: "Small", kind: "invariant", trace: { states: [{ action: undefined, vars: { seen: [], n: 0 } }, { action: "Up", vars: { seen: [0], n: 1 } }] } }] });
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

test("definitionLevels reads each definition's level from SANY's XML, written before its name or after it", () => {
	expect([...definitionLevels(SANY_XML)]).toEqual([["Ends", 3], ["StateProp", 1]]);
});

test("watchModule prints each broken rule's states under a module, an invariant and a marker no spec text holds", () => {
	expect(watchModule("Count", ["Small", "Tiny"], ["seen", "n"], ["Count.tla", "---- MODULE Count ----\n\\* drawn by Statechart\n===="])).toEqual({
		module: "Statechart2Breaks",
		invariant: "Statechart2Watch",
		marker: "Statechart2",
		text: `---- MODULE Statechart2Breaks ----
EXTENDS Count, TLC
Statechart2Watch ==
  /\\ (~(Small) => PrintT(<<"Statechart2", "Small", <<seen, n>>>>))
  /\\ (~(Tiny) => PrintT(<<"Statechart2", "Tiny", <<seen, n>>>>))
====
`,
	});
});

test("printedBreaks reads each state a rule breaks, whether TLC wraps the printed tuple or everystate keeps it on one line", () => {
	const state = (fixRuns: number) => stateKey({ phase: "checking-the-very-long-phase-name", log: { 1: "alpha-entry", 2: "beta-entry", 3: "gamma-entry", 4: "delta-entry" }, counts: { fixRuns, reviewRuns: 0, planRuns: 0, tokens: 0 } });
	for (const output of [PRINTED_BY_TLC, PRINTED_BY_EVERYSTATE]) expect(printedBreaks(output, "Statechart", ["phase", "log", "counts"])).toEqual(new Map([["Small", new Set([state(1), state(2)])]]));
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
	test("says how many states past the constraint break a rule, which the chart does not draw", () => {
		const { report } = draw(PAY, [{ ...PAID_TWICE, pastBound: 2 }], byPhase, settings);
		expect(report).toContain("| PaysOnce | breaks, also in 2 states past the constraint, which the chart does not draw |");
	});
	test("says a property with no temporal operator checks only the start states", () => {
		const { report } = draw(PAY, [{ rule: "StartsIdle", kind: "property", initialOnly: true }], byPhase, settings);
		expect(report).toContain("| StartsIdle | holds, checking only the start states");
	});
	test("draws no chart for a model too large to draw when no rule breaks", () => {
		expect(draw(PAY, [], byPhase, { ...settings, complete: false }).mermaid).toBeUndefined();
	});
});

/** Climb's dump and Start's are the same: x goes 0, 1, 2 by Next. */
const ZERO_TO_TWO_DOT = `strict digraph DiskGraph {
nodesep=0.35;
subgraph cluster_graph {
color="white";
8951627508073401491 [label="x = 0",style = filled]
8951627508073401491 -> 9015575927165504391 [label="Next",color="black",fontcolor="black"];
9015575927165504391 [label="x = 1"];
9015575927165504391 -> -4558582891141179340 [label="Next",color="black",fontcolor="black"];
-4558582891141179340 [label="x = 2"];
{rank = same; 8951627508073401491;}
{rank = same; 9015575927165504391;}
}
}`;

const LEAP_DOT = `strict digraph DiskGraph {
nodesep=0.35;
subgraph cluster_graph {
color="white";
8951627508073401491 [label="x = 0",style = filled]
8951627508073401491 -> 9015575927165504391 [label="Inc",color="black",fontcolor="black"];
9015575927165504391 [label="x = 1"];
9015575927165504391 -> -4558582891141179340 [label="Inc",color="black",fontcolor="black"];
-4558582891141179340 [label="x = 2"];
-4558582891141179340 -> -8872841427029313142 [label="Inc",color="black",fontcolor="black"];
-8872841427029313142 [label="x = 3"];
-8872841427029313142 -> 7031572846926829618 [label="Inc",color="black",fontcolor="black"];
7031572846926829618 [label="x = 4"];
7031572846926829618 -> -6938108150182140576 [label="Inc",color="black",fontcolor="black"];
-6938108150182140576 [label="x = 5"];
{rank = same; 8951627508073401491;}
{rank = same; 9015575927165504391;}
{rank = same; -4558582891141179340;}
{rank = same; -8872841427029313142;}
{rank = same; 7031572846926829618;}
}
}`;

const PARAMS_DOT = `strict digraph DiskGraph {
nodesep=0.35;
subgraph cluster_graph {
color="white";
-3343820705465830753 [label="c = (p1 :> 0 @@ p2 :> 0)",style = filled]
-3343820705465830753 -> -2601257132019441491 [label="Bump",color="black",fontcolor="black"];
-2601257132019441491 [label="c = (p1 :> 1 @@ p2 :> 0)"];
-3343820705465830753 -> 2618802929728384722 [label="Bump",color="black",fontcolor="black"];
2618802929728384722 [label="c = (p1 :> 0 @@ p2 :> 1)"];
-2601257132019441491 -> 3815098365656490992 [label="Bump",color="black",fontcolor="black"];
3815098365656490992 [label="c = (p1 :> 1 @@ p2 :> 1)"];
2618802929728384722 -> 3815098365656490992 [label="Bump",color="black",fontcolor="black"];
{rank = same; -3343820705465830753;}
{rank = same; -2601257132019441491;2618802929728384722;}
}
}`;

const CONFORMS = `{"status":"conforms","observations":3,"ignored":0,"matched":3,"candidates":1}`;
const TRACE_ERROR = `{"status":"trace-error","message":"not valid JSON: unterminated JSON string","line":1,"observations":0,"ignored":0,"matched":0,"candidates":0,"lastMatched":null}`;
const REJECTS = {
	climb: `{"status":"mismatch","message":"The spec allows no further step from the state the trace has reached.","line":1,"observations":4,"ignored":0,"matched":3,"candidates":1,"failed":{"index":4,"line":1,"observation":{"state":{"x":3}}},"lastMatched":{"index":3,"line":1,"candidates":1},"before":[{"x":2}],"nearest":[],"enabled":[],"hints":["1 matching state is outside the model's bound Bound (a CONSTRAINT in the configuration). Rerun with -noconstraints to follow the trace beyond it."]}`,
	leap: `{"status":"mismatch","message":"No step the spec allows here produces the observed values.","line":1,"observations":2,"ignored":0,"matched":1,"candidates":1,"failed":{"index":2,"line":1,"observation":{"state":{"x":3}}},"lastMatched":{"index":1,"line":1,"candidates":1},"before":[{"x":0}],"nearest":[{"action":"Inc","differs":[{"var":"x","observed":3,"expected":1}]}],"enabled":[{"action":"Inc","produces":{"x":1},"matchesState":false}],"hints":["1 matching state is outside the model's bound Small (a CONSTRAINT in the configuration). Rerun with -noconstraints to follow the trace beyond it.","The observation can be matched if 2 steps went unlogged before it. If the log does not record every step, rerun with -hidden 2."]}`,
	leapTo4: `{"status":"mismatch","message":"No step the spec allows here produces the observed values.","line":1,"observations":3,"ignored":0,"matched":2,"candidates":1,"failed":{"index":3,"line":1,"observation":{"state":{"x":4}}},"lastMatched":{"index":2,"line":1,"candidates":1},"before":[{"x":1}],"nearest":[{"action":"Inc","differs":[{"var":"x","observed":4,"expected":2}]}],"enabled":[{"action":"Inc","produces":{"x":2},"matchesState":false}],"hints":["1 matching state is outside the model's bound Small (a CONSTRAINT in the configuration). Rerun with -noconstraints to follow the trace beyond it.","The observation can be matched if 2 steps went unlogged before it. If the log does not record every step, rerun with -hidden 2."]}`,
	start: `{"status":"mismatch","message":"No initial state of the spec has the observed values.","line":1,"observations":1,"ignored":0,"matched":0,"candidates":1,"failed":{"index":1,"line":1,"observation":{"state":{"x":5}}},"lastMatched":null,"before":[],"nearest":[{"action":null,"differs":[{"var":"x","observed":5,"expected":0}]}],"enabled":[]}`,
	params: `{"status":"mismatch","message":"No step the spec allows here produces the observed values.","line":1,"observations":3,"ignored":0,"matched":2,"candidates":1,"failed":{"index":3,"line":1,"observation":{"state":{"c":{"p1":2,"p2":0}}}},"lastMatched":{"index":2,"line":1,"candidates":1},"before":[{"c":{"p1":1,"p2":0}}],"nearest":[{"action":"Bump(p2)","differs":[{"var":"c","observed":{"p1":2,"p2":0},"expected":{"p1":1,"p2":1}}]}],"enabled":[{"action":"Bump(p2)","produces":{"c":{"p1":1,"p2":1}},"matchesState":false}],"hints":["1 matching state is outside the model's bound Bound (a CONSTRAINT in the configuration). Rerun with -noconstraints to follow the trace beyond it."]}`,
	shapes: `{"status":"mismatch","message":"The spec allows no further step from the state the trace has reached.","line":1,"observations":3,"ignored":0,"matched":2,"candidates":1,"failed":{"index":3,"line":1,"observation":{"state":{"str":"go","b":true,"e":{},"f":{"1":"x","2":"y"},"g":{"p1":2,"p2":0},"m":"p1","n":2,"q":{"1":"a","2":2,"3":0,"4":1},"r":{"b":[],"a":1},"s":[1,2,3,4]}}},"lastMatched":{"index":2,"line":1,"candidates":1},"before":[{"str":"go","b":false,"e":[],"f":["x","y"],"g":{"p1":1,"p2":0},"m":"p1","n":1,"q":["a",2,0],"r":{"b":[],"a":0},"s":[1,2,3]}],"nearest":[],"enabled":[],"hints":["1 matching state is outside the model's bound Bound (a CONSTRAINT in the configuration). Rerun with -noconstraints to follow the trace beyond it."]}`,
};

const SHAPES_RUN = `Error: Invariant Safe is violated.
Error: The behavior up to this point is:
State 1: <Initial predicate>
/\\ str = "go"
/\\ b = TRUE
/\\ e = <<>>
/\\ f = <<"x", "y">>
/\\ g = (p1 :> 0 @@ p2 :> 0)
/\\ m = p1
/\\ n = 0
/\\ q = <<"a", 2>>
/\\ r = [b |-> {}, a |-> 1]
/\\ s = {1, 2}

State 2: <Next line 9, col 9 to line 11, col 58 of module Shapes>
/\\ str = "go"
/\\ b = FALSE
/\\ e = <<>>
/\\ f = <<"x", "y">>
/\\ g = (p1 :> 1 @@ p2 :> 0)
/\\ m = p1
/\\ n = 1
/\\ q = <<"a", 2, 0>>
/\\ r = [b |-> {}, a |-> 0]
/\\ s = {1, 2, 3}

State 3: <Next line 9, col 9 to line 11, col 58 of module Shapes>
/\\ str = "go"
/\\ b = TRUE
/\\ e = <<>>
/\\ f = <<"x", "y">>
/\\ g = (p1 :> 2 @@ p2 :> 0)
/\\ m = p1
/\\ n = 2
/\\ q = <<"a", 2, 0, 1>>
/\\ r = [b |-> {}, a |-> 1]
/\\ s = {1, 2, 3, 4}`;
const SHAPES_OBSERVED = `[{"state":{"str":"go","b":true,"e":{},"f":{"1":"x","2":"y"},"g":{"p1":0,"p2":0},"m":"p1","n":0,"q":{"1":"a","2":2},"r":{"b":[],"a":1},"s":[1,2]}},{"state":{"str":"go","b":false,"e":{},"f":{"1":"x","2":"y"},"g":{"p1":1,"p2":0},"m":"p1","n":1,"q":{"1":"a","2":2,"3":0},"r":{"b":[],"a":0},"s":[1,2,3]}},{"state":{"str":"go","b":true,"e":{},"f":{"1":"x","2":"y"},"g":{"p1":2,"p2":0},"m":"p1","n":2,"q":{"1":"a","2":2,"3":0,"4":1},"r":{"b":[],"a":1},"s":[1,2,3,4]}}]`;

const xIs = (x: number): Vars => ({ x });
const counter = (p1: number, p2: number): Vars => ({ c: { p1, p2 } });
const cutBy = (trace: Trace, answer: string, pastBound: boolean): Trace => {
	const rejected = rejectedState(answer);
	return rejected === undefined ? trace : { ...trace, cut: { at: rejected, pastBound } };
};
const CLIMB = cutBy(traceOf([undefined, xIs(0)], ["Next", xIs(1)], ["Next", xIs(2)], ["Next", xIs(3)]), REJECTS.climb, true);
const LEAP = cutBy(traceOf([undefined, xIs(0)], ["Jump", xIs(3)]), REJECTS.leap, false);
const LEAP_TO_4 = cutBy(traceOf([undefined, xIs(0)], ["Inc", xIs(1)], ["Jump", xIs(4)]), REJECTS.leapTo4, false);
const LEAP_TO_2 = cutBy(traceOf([undefined, xIs(0)], ["Inc", xIs(1)], ["Inc", xIs(2)]), CONFORMS, false);
const START = cutBy(traceOf([undefined, xIs(5)]), REJECTS.start, true);
const PARAMS = cutBy(traceOf([undefined, counter(0, 0)], ["Bump(p1)", counter(1, 0)], ["Bump(p1)", counter(2, 0)]), REJECTS.params, true);

const breaksSafe = (trace: Trace): Verdict => ({ rule: "Safe", kind: "invariant", trace, breaking: new Set([stateKey(trace.states.at(-1)!.vars)]) });
const PAST = "1 drawn state lies past the constraint, which everystate's count leaves out.";
const CUT_MARK = "(cut by the constraint)";
const cutMarks = ({ report, mermaid }: Drawing) => [...report.split("\n").filter((line) => line.includes(CUT_MARK)), ...mermaid!.split("\n").filter((line) => line.includes(CUT_MARK)).map((line) => line.split(" : ")[1])];

describe("under a bound", () => {
	test("rejectedState reads only conform's status and failed index, as an index into the path's states, though a hint calls an ACTION_CONSTRAINT a CONSTRAINT", () => {
		expect([REJECTS.leap, REJECTS.start, CONFORMS].map(rejectedState)).toEqual([1, 0, undefined]);
		expect(() => rejectedState(TRACE_ERROR)).toThrow(/neither "conforms" nor a mismatch/);
	});
	test("in complete mode, the step conform finds cut is each step of a path the dump lacks, by the states it joins", () => {
		const joins = (steps: Step[]) => steps.map(({ from, to }) => `${from} -> ${to}`);
		for (const [dot, path] of [[ZERO_TO_TWO_DOT, CLIMB], [LEAP_DOT, LEAP], [LEAP_DOT, LEAP_TO_4], [LEAP_DOT, LEAP_TO_2], [ZERO_TO_TWO_DOT, START], [PARAMS_DOT, PARAMS]] as const) {
			const dumped = new Set(joins(parseDot(dot).steps));
			const steps = traceSteps(path);
			expect(joins(steps.filter((step) => step.cut))).toEqual(joins(steps).filter((step) => !dumped.has(step)));
		}
	});
	test("withPaths adds to the dump only the steps a bound cuts, so an allowed step the trace names with its parameters is drawn once", () => {
		const graph = withPaths(parseDot(PARAMS_DOT), [PARAMS]);
		expect(graph.steps.map((step) => [step.action, step.cut ?? false])).toEqual([["Bump", false], ["Bump", false], ["Bump", false], ["Bump", false], ["Bump(p1)", true]]);
		expect([...graph.states.values()].filter((state) => state.pastBound).map((state) => state.vars)).toEqual([counter(2, 0)]);
	});
	const ROWS: [string, string, Trace, boolean[], string[], boolean][] = [
		["Climb above --chart-states: the last step is marked", ZERO_TO_TWO_DOT, CLIMB, [false], ["3. Next (cut by the constraint) → x = 3", "Next (cut by the constraint)"], true],
		["Climb, complete: the last step is marked, and one drawn state lies past the constraint", ZERO_TO_TWO_DOT, CLIMB, [true], ["3. Next (cut by the constraint) → x = 3", "Next (cut by the constraint)"], true],
		["Leap, both modes: the Jump step is marked, and no state lies past the constraint", LEAP_DOT, LEAP, [true, false], ["1. Jump (cut by the constraint) → x = 3", "Jump (cut by the constraint)"], false],
		["Leap with Safe == x # 4, both modes: the Jump step is marked, and no state lies past the constraint", LEAP_DOT, LEAP_TO_4, [true, false], ["2. Jump (cut by the constraint) → x = 4", "Jump (cut by the constraint)"], false],
		["Leap with Safe == x # 2, both modes: no step is marked", LEAP_DOT, LEAP_TO_2, [true, false], [], false],
		["a one-state path whose start lies past the bound, both modes: no step to mark", ZERO_TO_TWO_DOT, START, [true, false], [], true],
	];
	for (const [name, dot, path, modes, marks, past] of ROWS)
		test(name, () => {
			for (const complete of modes) {
				const drawing = draw(complete ? withPaths(parseDot(dot), [path]) : pathGraph([path]), [breaksSafe(path)], {}, { title: "Probe", distinct: 3, complete, arrowBudget: 20 });
				expect(cutMarks(drawing)).toEqual(marks);
				expect(drawing.report.includes(PAST)).toBe(past);
			}
		});
	test("a cut step and an allowed step between the same two labels draw as two arrows", () => {
		const view: View = { state: (vars) => (Number(vars.x) < 3 ? "low" : "high"), step: () => "moves" };
		const { mermaid } = draw(withPaths(parseDot(LEAP_DOT), [LEAP]), [breaksSafe(LEAP)], view, { title: "Probe", distinct: 6, complete: true, arrowBudget: 20 });
		expect(mermaid!.split("\n").filter((line) => line.includes(" : moves"))).toEqual(["  s0 --> s1 : moves", "  s0 --> s1 : moves (cut by the constraint)"]);
	});
	test("a bounded path that loops or stutters replays whole: traceObservations sends the step back into a loop, and no stutter", () => {
		expect(JSON.parse(traceObservations(readRun(LASSO).violations[0].trace))).toEqual([{ state: { phase: "checking" } }, { state: { phase: "fixing" } }, { state: { phase: "checking" } }]);
		expect(JSON.parse(traceObservations(readRun(STUTTER).violations[0].trace))).toEqual([{ state: { phase: "checking" } }]);
	});
	test("Shapes: traceObservations sends every value shape as conform read it, and conform's answer cuts the last step", () => {
		const path = readRun(SHAPES_RUN).violations[0].trace;
		expect(traceObservations(path)).toBe(SHAPES_OBSERVED);
		expect(traceSteps(cutBy(path, REJECTS.shapes, true)).map((step) => step.cut)).toEqual([false, true]);
	});
});
