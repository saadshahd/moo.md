import { interactionAt, isWaitingOnOwner, nextStates, overCapWaits, reachedFrom, requestsAllowed } from "../config/machine.ts";
import type { Kind } from "../config/schema.ts";
import type { OpenItem } from "./format.ts";

/** Where an item's flow stands at one step: the steps its row shows, those it has passed, and what the owner may do there. */
export type FlowAt = Pick<OpenItem, "steps" | "at" | "passed" | "controls">;

/**
 * A kind's flow, its graph read once: for each step an item may be in, given the states it has left, the steps its row
 * shows, the shown ones it has passed other than this one, and the owner's controls there; undefined at a final step or
 * one the flow lacks. A note may go to each shown step the item can still reach
 * through every transition from the steps after this one, so this step only where a loop leads back to it, and never
 * to a final one.
 */
export type Flow = (at: string, left: readonly string[] | undefined) => FlowAt | undefined;

export const flowOf = (kind: Kind): Flow => {
	const { states } = kind.machine;
	const next = nextStates(kind);
	const hidden = overCapWaits(kind);
	const isFinal = (state: string): boolean => states[state]?.type === "final";

	return (at, left) => {
		const node = states[at];

		if (node === undefined || isFinal(at)) return undefined;

		const shown = Object.keys(states).filter((state) => state === at || !hidden.has(state));
		const reached = new Set((next.get(at) ?? []).flatMap((after) => [...reachedFrom(after, next)]));
		const interaction = interactionAt(kind, at);

		return {
			steps: shown.map((name) => ({ name, waitsOnOwner: isWaitingOnOwner(kind, name) })),
			at,
			passed: left?.filter((state) => state !== at && shown.includes(state)),
			controls: {
				choices: (interaction?.choices ?? []).map(({ label, event }) => ({ label, event: event.type })),
				answer: interaction?.textEvent !== undefined,
				...requestsAllowed(kind, at),
				noteTo: shown.filter((state) => reached.has(state) && !isFinal(state)),
			},
		};
	};
};
