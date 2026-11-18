import { type AnyActorLogic, type AnyStateMachine, createAsyncLogic, machineFromJSON } from "xstate";
import { toDirectedGraph } from "xstate/graph";
import { z } from "zod";
import { HOUR_MS } from "../time.ts";
import type { Json } from "./json.ts";
import { isFixedPart, type Kind, type StateNodeJSON } from "./schema.ts";

const placeholder = createAsyncLogic({ run: async () => {} });

/** The paths the item's change touches as its machine runs: what a `touches` guard reads. */
export type Touched = () => readonly string[];

/** Where no run is at hand, a guard has no change to read: the machine is broken, and the guard throws rather than pass or fail. */
const noChange: Touched = () => {
	throw new Error("a guard read the change's paths where no run is at hand");
};

/** The guards a kind's transition may name, by the params each takes. */
export const GUARD_PARAMS = {
	/** Passes when the change touches a path one of `paths` matches. */
	touches: z.strictObject({ paths: z.array(z.string().min(1)).min(1) }),
} as const;

/** The guards' implementations, reading the change through `touched`. */
const guardsOf = (touched: Touched) => ({
	touches: (_: { readonly event: { readonly type: string } }, params: Json): boolean => {
		const { paths } = GUARD_PARAMS.touches.parse(params);

		return touched().some((path) => paths.some((glob) => new Bun.Glob(glob).match(path)));
	},
});

/** What a run past its token cap, or a run's question for the owner, sends the machine. */
export const TOKEN_CAP = "token-cap";

/** What the owner's answer sends the wait it was given at. */
export const ANSWERED = "answered";

/**
 * The kind as hum runs it. A state that invokes a role's run and names no `token-cap` transition stops, past the cap,
 * at the wait `<overCap>-<state>`: the kind's own state of that name, else a copy of its `tokenCap.overCap` wait whose
 * answer leads back to the state, so the owner's answer runs it again and skips nothing after it.
 */
export const withOverCapWaits = (kind: Kind): Kind => {
	const { machine, tokenCap } = kind;
	const wait = machine.states[tokenCap.overCap];

	if (wait === undefined) return kind;

	const waitOf = (run: string): string => `${tokenCap.overCap}-${run}`;

	const runs = Object.entries(machine.states)
		.filter(([, node]) => node.invoke !== undefined && !isFixedPart(node.invoke.src) && node.on?.[TOKEN_CAP] === undefined)
		.map(([name]) => name);

	const states = Object.fromEntries(Object.entries(machine.states).map(([name, node]) => [name, runs.includes(name) ? { ...node, on: { ...node.on, [TOKEN_CAP]: [{ target: waitOf(name) }] } } : node]));
	const waits = Object.fromEntries(runs.map((run) => [waitOf(run), machine.states[waitOf(run)] ?? { ...wait, on: { ...wait.on, [ANSWERED]: [{ target: run }] } }]));

	return { ...kind, machine: { ...machine, states: { ...states, ...waits } } };
};

/**
 * A kind's machine. `machineFromJSON` needs an actor for every `invoke.src`; any
 * `sources` not given stand in as placeholders, which is enough to check the graph.
 * Its guards read the change through `touched`, and throw where none is given.
 * Throws with xstate's message when the machine is illegal.
 */
export const kindMachine = (kind: Kind, sources: Readonly<Record<string, AnyActorLogic>> = {}, touched: Touched = noChange): AnyStateMachine => {
	// SAFETY: the zod machine schema is a subset of xstate's MachineJSON, and machineFromJSON validates the rest.
	return machineFromJSON(kind.machine as Parameters<typeof machineFromJSON>[0], { actors: invokedSources(kind, placeholder, sources), guards: guardsOf(touched) });
};

/** A state's `after` timeouts, shortest first: each one's delay in ms and the transitions it takes. */
export const timeoutsOf = (node: StateNodeJSON | undefined): { readonly ms: number; readonly transitions: NonNullable<StateNodeJSON["after"]>[string] }[] =>
	Object.entries(node?.after ?? {})
		.map(([delay, transitions]) => ({ ms: Number(delay), transitions }))
		.sort((a, b) => a.ms - b.ms);

/** A state's earliest `after` timeout: its hours and the transitions it takes; undefined for a state with none. */
export const earliestTimeout = (node: StateNodeJSON | undefined) => {
	const [earliest] = timeoutsOf(node);

	return earliest && { hours: earliest.ms / HOUR_MS, transitions: earliest.transitions };
};

/** An actor for each source the kind's machine invokes: the one `sources` gives, else `fallback`. */
export const invokedSources = (kind: Kind, fallback: AnyActorLogic, sources: Readonly<Record<string, AnyActorLogic>> = {}): Record<string, AnyActorLogic> =>
	Object.fromEntries(Object.values(kind.machine.states).flatMap(({ invoke }) => (invoke ? [[invoke.src, sources[invoke.src] ?? fallback]] : [])));

/** Each state's next states, by every transition of the kind's machine. */
export const nextStates = (kind: Kind): ReadonlyMap<string, readonly string[]> => {
	const next = new Map<string, string[]>();

	for (const node of toDirectedGraph(kindMachine(kind)).children) for (const edge of node.edges) next.set(edge.source.key, [...(next.get(edge.source.key) ?? []), edge.target.key]);

	return next;
};

/** The states `from` reaches through `next`, `from` among them; `expands` says which reached states lead on. */
export const reachedFrom = (from: string, next: ReadonlyMap<string, readonly string[]>, expands: (state: string) => boolean = () => true): ReadonlySet<string> => {
	const seen = new Set([from]);
	const todo = [from];

	for (let state = todo.pop(); state !== undefined; state = todo.pop()) {
		if (!expands(state)) continue;

		for (const target of next.get(state) ?? []) {
			if (seen.has(target)) continue;

			seen.add(target);
			todo.push(target);
		}
	}

	return seen;
};
