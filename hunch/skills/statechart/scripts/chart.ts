/**
 * Draws a model's states as a Mermaid statechart in the reader's words, and writes the report, refusing
 * a view that would make the chart claim what the model does not do.
 */
import { type Graph, must, type Step, type Trace, type Vars, stateKey } from "./tlc.ts";

/** What a view module exports: the reader's words for a state and for a step, and the chart's title.
 * \`step\` returns null for a step the chart hides. */
export type View = {
	state?: (vars: Vars) => unknown;
	step?: (action: string, from: Vars, to: Vars) => unknown;
	title?: unknown;
};

/** One rule and what TLC found. A broken rule carries its path and the states known to break it. */
export type Verdict = {
	rule: string;
	kind: "invariant" | "deadlock" | "property";
	trace?: Trace;
	breaking?: ReadonlySet<string>;
	initialOnly?: boolean;
};

/** A view or a model the chart cannot draw honestly; the message says what to change. */
export class Refusal extends Error {}

export type Drawing = { mermaid: string | undefined; report: string };

export type Settings = { title: string; distinct: number; complete: boolean; arrowBudget: number };

const LEAKED = /\b(undefined|NaN)\b|\[object Object\]/;

const shown = (value: unknown) => (typeof value === "string" ? JSON.stringify(value) : String(value));

function readerText(value: unknown, asked: string): string {
	if (typeof value !== "string" || value.trim() === "" || LEAKED.test(value))
		throw new Refusal(`${asked} returned ${shown(value)}. Return text the reader can read, with no undefined or NaN in it.`);
	return value.replace(/\s+/g, " ").trim();
}

const varsText = (vars: Vars) =>
	Object.entries(vars)
		.map(([name, value]) => `${name} = ${JSON.stringify(value)}`)
		.join(", ");

const stepId = ({ from, to, action }: Step) => `${from}|${to}|${action}`;

/** Each step a trace takes, the step back into its loop among them. */
const traceSteps = ({ states }: Trace): Step[] =>
	states.slice(1).flatMap(({ action, vars }, i) => (action === undefined ? [] : [{ from: stateKey(states[i].vars), to: stateKey(vars), action }]));

const loopKeys = ({ states, loop }: Trace) => new Set(loop === undefined ? [] : states.slice(loop).map(({ vars }) => stateKey(vars)));

const MARK_STYLE = {
	breaks: "fill:#ffecee,stroke:#e72e3b,stroke-width:2px,color:#cd2834",
	mayBreak: "fill:#fff3e6,stroke:#e8730c,stroke-width:2px,color:#b85a06",
	repeats: "stroke:#9b35d6,stroke-width:2px,stroke-dasharray:6 3",
	bugPath: "stroke:#1680f3,stroke-width:2px",
} as const;
type Mark = keyof typeof MARK_STYLE;

const mermaidText = (text: string) => text.replace(/[;:\n]/g, ",");

export function draw(graph: Graph, verdicts: Verdict[], view: View, settings: Settings): Drawing {
	const labels = new Map<string, string>();
	for (const [key, { vars }] of graph.states) labels.set(key, view.state ? readerText(view.state(vars), `state() for ${varsText(vars)}`) : varsText(vars));
	const labelOf = (key: string) => must(labels.get(key), `a path passes a state the graph does not hold: ${key}`);
	const varsOf = (key: string) => graph.states.get(key)?.vars ?? {};

	const stepLabels = new Map<string, string | null>();
	const stepLabel = (step: Step) => {
		const id = stepId(step);
		if (!stepLabels.has(id)) {
			const said = view.step ? view.step(step.action, varsOf(step.from), varsOf(step.to)) : step.action;
			stepLabels.set(id, said === null ? null : readerText(said, `step() for ${step.action} from "${labelOf(step.from)}" to "${labelOf(step.to)}"`));
		}
		return stepLabels.get(id) ?? null;
	};
	const steps = graph.steps.map((step) => ({ ...step, label: stepLabel(step), fromLabel: labelOf(step.from), toLabel: labelOf(step.to) }));
	const moves = steps.filter((s) => s.fromLabel !== s.toLabel);

	const broken = verdicts.filter((v) => v.trace);
	for (const verdict of broken) {
		const path = new Set(traceSteps(verdict.trace!).map(stepId));
		const loop = loopKeys(verdict.trace!);
		for (const s of steps) {
			if (s.label !== null) continue;
			if (path.has(stepId(s))) throw new Refusal(`step() hides ${s.action} from "${s.fromLabel}" to "${s.toLabel}". It is on the path to the ${verdict.rule} bug, so the chart must draw it.`);
			if (loop.has(s.from) && !loop.has(s.to)) throw new Refusal(`step() hides ${s.action} from "${s.fromLabel}" to "${s.toLabel}". It leaves the loop of the ${verdict.rule} bug, so the chart must draw it.`);
		}
	}

	const byArrow = Map.groupBy(moves, (s) => `${s.fromLabel}|${s.toLabel}|${s.action}`);
	for (const group of byArrow.values())
		if (group.some((s) => s.label === null) && group.some((s) => s.label !== null))
			throw new Refusal(`step() hides some ${group[0].action} steps from "${group[0].fromLabel}" to "${group[0].toLabel}" and draws others. Hide all of an arrow or none, or the arrow reads as if it needs less than it does.`);

	const drawn = moves.filter((s) => s.label !== null);
	const arrows = [...new Map(drawn.map((s) => [`${s.fromLabel}|${s.toLabel}|${s.label}`, s])).values()];
	const chartStates = [...new Set(labels.values())];

	if (settings.complete)
		for (const label of chartStates)
			if (moves.some((s) => s.fromLabel === label) && !drawn.some((s) => s.fromLabel === label))
				throw new Refusal(`"${label}" has steps out in the model, but the chart hides every one. Keep at least one arrow out of it.`);

	const starts = new Set([...graph.states].filter(([, s]) => s.start).map(([key]) => labelOf(key)));
	const reached = new Set(starts);
	const frontier = [...starts];
	for (let label = frontier.pop(); label !== undefined; label = frontier.pop())
		for (const s of drawn)
			if (s.fromLabel === label && !reached.has(s.toLabel)) {
				reached.add(s.toLabel);
				frontier.push(s.toLabel);
			}
	const unreached = chartStates.filter((label) => !reached.has(label));
	if (unreached.length) throw new Refusal(`No drawn arrow leads from a start state to ${unreached.map((l) => `"${l}"`).join(", ")}. Draw the steps that reach it.`);

	for (const verdict of broken) {
		const loop = loopKeys(verdict.trace!);
		const loopLabels = new Set([...loop].map(labelOf));
		for (const arrow of arrows) {
			if (!loopLabels.has(arrow.fromLabel) || loopLabels.has(arrow.toLabel)) continue;
			const loopTakesIt = drawn.some((s) => loop.has(s.from) && s.fromLabel === arrow.fromLabel && s.toLabel === arrow.toLabel && s.label === arrow.label);
			if (!loopTakesIt) throw new Refusal(`The chart draws "${arrow.label}" out of "${arrow.fromLabel}", where the ${verdict.rule} bug loops, but the loop cannot take it there. Show in a label what stops it.`);
		}
	}

	const rulesAt = (key: string) => broken.filter((v) => v.breaking?.has(key)).map((v) => v.rule);
	const members = Map.groupBy([...graph.states.keys()], labelOf);
	const marks = new Map<string, { mark: Mark; rules: string[] }>();
	for (const [label, keys] of members) {
		const sets = [...new Set(keys.map((k) => rulesAt(k).join(", ")).filter(Boolean))];
		if (sets.length > 1) throw new Refusal(`"${label}" merges states that break different rules (${sets.join("; ")}). Give them different labels, so the reader sees which rule breaks where.`);
		if (sets.length === 1) marks.set(label, { mark: keys.every((k) => rulesAt(k).length) ? "breaks" : "mayBreak", rules: sets[0].split(", ") });
	}
	for (const verdict of broken) {
		for (const key of loopKeys(verdict.trace!)) if (!marks.has(labelOf(key))) marks.set(labelOf(key), { mark: "repeats", rules: [verdict.rule] });
		for (const step of traceSteps(verdict.trace!)) for (const key of [step.from, step.to]) if (!marks.has(labelOf(key))) marks.set(labelOf(key), { mark: "bugPath", rules: [verdict.rule] });
	}

	const id = new Map(chartStates.map((label, i) => [label, `s${i}`]));
	const mermaid =
		settings.complete || broken.length
			? [
					"---",
					`title: ${mermaidText(settings.title)}`,
					"---",
					"stateDiagram-v2",
					...Object.entries(MARK_STYLE).map(([mark, style]) => `  classDef ${mark} ${style}`),
					...chartStates.map((label) => `  ${id.get(label)} : ${mermaidText(label)}`),
					...[...starts].map((label) => `  [*] --> ${id.get(label)}`),
					...arrows.map((a) => `  ${id.get(a.fromLabel)} --> ${id.get(a.toLabel)} : ${mermaidText(a.label!)}`),
					...[...marks].map(([label, { mark }]) => `  class ${id.get(label)} ${mark}`),
				].join("\n") + "\n"
			: undefined;

	const pathText = (verdict: Verdict) => {
		const { states, loop, stutters } = verdict.trace!;
		const taken = traceSteps(verdict.trace!);
		const exact = verdict.kind === "property" ? "A path" : "The shortest path";
		return [
			`${exact} has ${taken.length} step${taken.length === 1 ? "" : "s"}:`,
			"",
			`0. ${labelOf(stateKey(states[0].vars))} (start)`,
			...taken.map((s, i) => `${i + 1}. ${stepLabel(s)} → ${labelOf(s.to)}`),
			...(loop !== undefined ? ["", `From step ${loop} it repeats forever.`] : []),
			...(stutters ? ["", `Then it stays in ${labelOf(stateKey(states.at(-1)!.vars))} forever.`] : []),
		].join("\n");
	};
	const verdictText = (v: Verdict) =>
		[v.trace ? "breaks" : "holds", v.initialOnly ? "checking only the start states: it has no [], <> or ~>, so write it as an INVARIANT to check every state" : ""].filter(Boolean).join(", ");
	const hidden = [...Map.groupBy(moves.filter((s) => s.label === null), (s) => `${s.action} from "${s.fromLabel}" to "${s.toLabel}"`).keys()];
	const report = [
		`# ${settings.title}`,
		"",
		[
			`TLC saw ${settings.distinct} distinct states.`,
			mermaid ? `The chart draws ${chartStates.length} states and ${arrows.length} arrows${arrows.length > settings.arrowBudget ? `; aim for about ${settings.arrowBudget}` : ""}.` : "No rule breaks and the model is too large to draw, so there is no chart.",
			settings.complete ? "" : "The model is too large to draw whole, so the chart draws only the paths to the rules that break.",
		]
			.filter(Boolean)
			.join(" "),
		"",
		"| rule | verdict |",
		"|---|---|",
		...verdicts.map((v) => `| ${v.rule} | ${verdictText(v)} |`),
		...[...marks].filter(([, m]) => m.mark === "breaks" || m.mark === "mayBreak").flatMap(([label, m], i) => (i === 0 ? ["", "## Where rules break", ""] : []).concat(`- ${label}: ${m.mark === "breaks" ? "breaks" : "may break"} ${m.rules.join(", ")}`)),
		...broken.flatMap((v) => ["", `## ${v.rule} breaks`, "", pathText(v)]),
		...(hidden.length ? ["", "## Steps the chart hides", "", ...hidden.map((h) => `- ${h}`)] : []),
	].join("\n") + "\n";
	return { mermaid, report };
}
