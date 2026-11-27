import { interactionAt, isWaitingOnOwner, overCapWaits, requestsAllowed } from "../config/machine.ts";
import type { HumConfig, Kind } from "../config/schema.ts";
import { type Going, noteFrom, noteReach } from "../decide/note.ts";
import type { OpenItem } from "./format.ts";

/** Where an item's flow stands at one step: the steps its row shows, those it has passed, and what the owner may do there. */
export type FlowAt = Pick<OpenItem, "steps" | "at" | "passed" | "controls">;

/**
 * A kind's flow, its graph read once: for each step an item may be in, given the states it has left and how it goes on,
 * the steps its row shows, the shown ones it has passed other than this one, and the owner's controls there, a note
 * going to each step `noteReach` gives; undefined at a final step or one the flow lacks.
 */
export type Flow = (at: string, left: readonly string[] | undefined, going: Going) => FlowAt | undefined;

export const flowOf = (kind: Kind, roles: HumConfig["roles"]): Flow => {
	const { states } = kind.machine;
	const hidden = overCapWaits(kind);
	const reach = noteReach(kind, roles);

	return (at, left, going) => {
		const node = states[at];

		if (node === undefined || node.type === "final") return undefined;

		const shown = Object.keys(states).filter((state) => state === at || !hidden.has(state));
		const reached = reach(noteFrom(kind, at, going));
		const interaction = interactionAt(kind, at);

		return {
			steps: shown.map((name) => ({ name, waitsOnOwner: isWaitingOnOwner(kind, name) })),
			at,
			passed: left?.filter((state) => state !== at && shown.includes(state)),
			controls: {
				choices: (interaction?.choices ?? []).map(({ label, event }) => ({ label, event: event.type })),
				answer: interaction?.textEvent !== undefined,
				...requestsAllowed(kind, at),
				noteTo: shown.filter((state) => reached.has(state)),
			},
		};
	};
};
