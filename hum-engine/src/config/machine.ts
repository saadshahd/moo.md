import { type AnyActorLogic, type AnyStateMachine, createAsyncLogic, machineFromJSON } from "xstate";
import { toDirectedGraph } from "xstate/graph";
import type { Kind } from "./schema.ts";

const placeholder = createAsyncLogic({ run: async () => {} });

/**
 * A kind's machine. `machineFromJSON` needs an actor for every `invoke.src`; any
 * `sources` not given stand in as placeholders, which is enough to check the graph.
 * Throws with xstate's message when the machine is illegal.
 */
export const kindMachine = (kind: Kind, sources: Readonly<Record<string, AnyActorLogic>> = {}): AnyStateMachine => {
	// SAFETY: the zod machine schema is a subset of xstate's MachineJSON, and machineFromJSON validates the rest.
	return machineFromJSON(kind.machine as Parameters<typeof machineFromJSON>[0], { actors: invokedSources(kind, placeholder, sources) });
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
