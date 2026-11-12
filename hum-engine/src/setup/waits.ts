import { OWNER_WAIT_TAG, STUCK_TAG, WAIT_TAG, type Kind, type StateNodeJSON } from "../config/schema.ts";
import { HOUR_MS } from "../time.ts";
import { WAIT_HOURS } from "./tables.ts";

/** A state a kind's machine waits in, with the hours its timeout proposes. */
export type Wait = { readonly kind: string; readonly state: string; readonly waitsOn: "owner" | "other"; readonly hours: number };

/** The answer for one wait: the hours after which the item ends stuck. */
export type WaitAnswers = Readonly<Record<string, number>>;

/** The key a wait's answer sits under. */
export const waitKey = ({ kind, state }: Pick<Wait, "kind" | "state">): string => `${kind}/${state}`;

const isOwnerWait = (tags: readonly string[] | undefined): boolean => tags?.includes(OWNER_WAIT_TAG) ?? false;

const isWait = (tags: readonly string[] | undefined): boolean => isOwnerWait(tags) || (tags?.includes(WAIT_TAG) ?? false);

/** Every waiting state of the kinds, each with a proposed timeout; setup asks the owner one question per wait. */
export const waitsOf = (kinds: Readonly<Record<string, Kind>>): Wait[] =>
	Object.entries(kinds).flatMap(([kind, config]) =>
		Object.entries(config.machine.states).flatMap(([state, node]): Wait[] => {
			if (!isWait(node.tags)) return [];

			const waitsOn = isOwnerWait(node.tags) ? "owner" : "other";

			return [{ kind, state, waitsOn, hours: WAIT_HOURS[waitsOn] }];
		}),
	);

/** The state a timed-out wait goes to: the kind's first stuck state. */
const stuckStateOf = (config: Kind): string | undefined => Object.entries(config.machine.states).find(([, node]) => node.tags?.includes(STUCK_TAG))?.[0];

const hasTimeout = (node: StateNodeJSON): boolean => node.timeout !== undefined || Object.keys(node.after ?? {}).length > 0;

/**
 * The kinds with a timeout on every wait: the hours answered, else the proposed hours. A timed-out wait ends stuck.
 * A wait that already has a timeout keeps it. A kind with no stuck state stays as it is, so the config check refuses its waits.
 */
export const withTimeouts = (kinds: Readonly<Record<string, Kind>>, answers: WaitAnswers): Record<string, Kind> =>
	Object.fromEntries(
		Object.entries(kinds).map(([kind, config]) => {
			const stuck = stuckStateOf(config);

			if (stuck === undefined) return [kind, config];

			const hoursOf = new Map(waitsOf({ [kind]: config }).map((wait) => [wait.state, answers[waitKey(wait)] ?? wait.hours]));

			const states = Object.entries(config.machine.states).map(([state, node]): [string, StateNodeJSON] => {
				const hours = hoursOf.get(state);

				return [state, hours === undefined || hasTimeout(node) ? node : { ...node, after: { [String(hours * HOUR_MS)]: [{ target: stuck }] } }];
			});

			return [kind, { ...config, machine: { ...config.machine, states: Object.fromEntries(states) } }];
		}),
	);
