import { type AnyActorLogic, type AnyStateMachine, createAsyncLogic, machineFromJSON } from "xstate";
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
