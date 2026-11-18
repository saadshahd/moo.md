import { type AnyActorLogic, type AnyStateMachine, createAsyncLogic, machineFromJSON } from "xstate";
import { toDirectedGraph } from "xstate/graph";
import { HOUR_MS } from "../time.ts";
import { FIXED_PARTS, type Kind, type StateNodeJSON } from "./schema.ts";

const placeholder = createAsyncLogic({ run: async () => {} });

/** What a run past its token cap, or a run's question for the owner, sends the machine. */
export const TOKEN_CAP = "token-cap";

const FIXED: ReadonlySet<string> = new Set(FIXED_PARTS);

/**
 * The kind's machine as hum runs it: a state that invokes a role's run and names no `token-cap` transition of its own
 * takes the kind's `tokenCap.overCap` on it, so a run past the cap reaches the owner wherever it runs.
 */
const withOverCap = ({ machine, tokenCap }: Kind): Kind["machine"] => ({
	...machine,
	states: Object.fromEntries(
		Object.entries(machine.states).map(([name, node]) => [name, node.invoke !== undefined && !FIXED.has(node.invoke.src) && node.on?.[TOKEN_CAP] === undefined ? { ...node, on: { ...node.on, [TOKEN_CAP]: [{ target: tokenCap.overCap }] } } : node]),
	),
});

/**
 * A kind's machine. `machineFromJSON` needs an actor for every `invoke.src`; any
 * `sources` not given stand in as placeholders, which is enough to check the graph.
 * Throws with xstate's message when the machine is illegal.
 */
export const kindMachine = (kind: Kind, sources: Readonly<Record<string, AnyActorLogic>> = {}): AnyStateMachine => {
	// SAFETY: the zod machine schema is a subset of xstate's MachineJSON, and machineFromJSON validates the rest.
	return machineFromJSON(withOverCap(kind) as Parameters<typeof machineFromJSON>[0], { actors: invokedSources(kind, placeholder, sources) });
};

/** A state's earliest `after` timeout: its hours and the transitions it takes; undefined for a state with none. */
export const earliestTimeout = (node: StateNodeJSON | undefined): { readonly hours: number; readonly transitions: NonNullable<StateNodeJSON["after"]>[string] } | undefined => {
	const [delay, transitions] = Object.entries(node?.after ?? {}).sort(([a], [b]) => Number(a) - Number(b))[0] ?? [];

	return delay === undefined || transitions === undefined ? undefined : { hours: Number(delay) / HOUR_MS, transitions };
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
