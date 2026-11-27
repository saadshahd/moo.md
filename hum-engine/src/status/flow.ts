import { cappedWaits, interactionAt, isRoute, isWaitingOnOwner, overCapWaits, requestsAllowed } from "../config/machine.ts";
import { type HumConfig, type Kind, STUCK_TAG } from "../config/schema.ts";
import { choiceWord } from "../decide/answer.ts";
import { type Going, noteFrom, noteReach } from "../decide/note.ts";
import type { OpenItem, StepPart } from "./format.ts";

/** The part each state of a kind's flow plays: its end, a condition a run's question or stuck leads to, a route that only picks the next step, else a step. */
const partsOf = (kind: Kind): ((state: string) => StepPart) => {
	const capped = cappedWaits(kind);

	return (state) => {
		const node = kind.machine.states[state];

		if (node?.type === "final") return "end";

		if (capped.has(state) || node?.tags?.includes(STUCK_TAG)) return "condition";

		return isRoute(node) ? "route" : "step";
	};
};

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
	const partOf = partsOf(kind);

	return (at, left, going) => {
		const node = states[at];

		if (node === undefined || node.type === "final") return undefined;

		const shown = Object.keys(states).filter((state) => state === at || !hidden.has(state));
		const reached = reach(noteFrom(kind, at, going));
		const interaction = interactionAt(kind, at);

		return {
			steps: shown.map((name) => ({ name, part: partOf(name), waitsOnOwner: isWaitingOnOwner(kind, name) })),
			at,
			passed: left?.filter((state) => state !== at && shown.includes(state)),
			controls: {
				choices: (interaction?.choices ?? []).map(({ label, event }) => {
					const answer = choiceWord(event.type);

					return answer === undefined ? { label, event: event.type } : { label, event: event.type, answer };
				}),
				answer: interaction?.textEvent !== undefined,
				...requestsAllowed(kind, at),
				noteTo: shown.filter((state) => reached.has(state)),
			},
		};
	};
};
