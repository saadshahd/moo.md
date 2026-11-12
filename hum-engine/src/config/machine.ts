import { type AnyActorLogic, type AnyStateMachine, createAsyncLogic, machineFromJSON } from "xstate";
import type { Kind } from "./schema.ts";

const placeholder = createAsyncLogic({ run: async () => {} });

/**
 * A kind's machine. `machineFromJSON` needs an actor for every `invoke.src`; any
 * `sources` not given stand in as placeholders, which is enough to check the graph.
 * Throws with xstate's message when the machine is illegal.
 */
export const kindMachine = (kind: Kind, sources: Readonly<Record<string, AnyActorLogic>> = {}): AnyStateMachine => {
	const actors: Record<string, AnyActorLogic> = {};

	for (const node of Object.values(kind.machine.states)) {
		if (node.invoke) actors[node.invoke.src] = sources[node.invoke.src] ?? placeholder;
	}

	// SAFETY: the zod machine schema is a subset of xstate's MachineJSON, and machineFromJSON validates the rest.
	return machineFromJSON(kind.machine as Parameters<typeof machineFromJSON>[0], { actors });
};
