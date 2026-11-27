import { interactionAt, isWaitingOnOwner, nextStates, overCapWaits, reachedFrom } from "../config/machine.ts";
import type { Kind } from "../config/schema.ts";
import type { OpenItem } from "./format.ts";

/** Where an item's flow stands at one step: the steps its row shows, and what the owner may do there. */
export type FlowAt = Pick<OpenItem, "steps" | "at" | "controls">;

/**
 * A kind's flow, its graph read once: for each step an item may be in, the steps its row shows and the owner's controls
 * there; undefined at a final step or one the flow lacks. A note may go to each shown step the item can still reach
 * through every transition from the steps after this one, so this step only where a loop leads back to it, and never
 * to a final one.
 */
export const flowOf = (kind: Kind): ((at: string) => FlowAt | undefined) => {
	const { states } = kind.machine;
	const next = nextStates(kind);
	const hidden = overCapWaits(kind);
	const isFinal = (state: string): boolean => states[state]?.type === "final";

	return (at) => {
		const node = states[at];

		if (node === undefined || isFinal(at)) return undefined;

		const shown = Object.keys(states).filter((state) => state === at || !hidden.has(state));
		const reached = new Set((next.get(at) ?? []).flatMap((after) => [...reachedFrom(after, next)]));
		const interaction = interactionAt(kind, at);

		return {
			steps: shown.map((name) => ({ name, waitsOnOwner: isWaitingOnOwner(kind, name) })),
			at,
			controls: {
				choices: (interaction?.choices ?? []).map(({ label, event }) => ({ label, event: event.type })),
				answer: interaction?.textEvent !== undefined,
				skip: node.meta?.skip !== undefined,
				runNow: Object.keys(node.after ?? {}).length > 0,
				noteTo: shown.filter((state) => reached.has(state) && !isFinal(state)),
			},
		};
	};
};
