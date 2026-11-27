import { STUCK_TAG, WAIT_TAG, type Kind, type StateNodeJSON } from "../config/schema.ts";
import { earliestTimeout, isOwnerWait } from "../config/machine.ts";
import { HOUR_MS } from "../time.ts";
import { WAIT_HOURS } from "./tables.ts";

/** A state a kind's machine waits in, with the hours its timeout proposes and the state the timeout leads to. */
export type Wait = { readonly kind: string; readonly state: string; readonly waitsOn: "owner" | "other"; readonly hours: number; readonly leadsTo: string | undefined };

/** The answer for one wait: the hours after which it times out. */
export type WaitAnswers = Readonly<Record<string, number>>;

/** The key a wait's answer sits under. */
const waitKey = ({ kind, state }: Pick<Wait, "kind" | "state">): string => `${kind}/${state}`;

const isWait = (node: StateNodeJSON): boolean => isOwnerWait(node) || (node.tags?.includes(WAIT_TAG) ?? false);

/** Every waiting state of the kinds, each with a proposed timeout and where it leads; setup asks the owner one question per wait. */
export const waitsOf = (kinds: Readonly<Record<string, Kind>>): Wait[] =>
	Object.entries(kinds).flatMap(([kind, config]) =>
		Object.entries(config.machine.states).flatMap(([state, node]): Wait[] => {
			if (!isWait(node)) return [];

			const waitsOn = isOwnerWait(node) ? "owner" : "other";
			const shipped = earliestTimeout(node);

			return [{ kind, state, waitsOn, hours: shipped?.hours ?? WAIT_HOURS[waitsOn], leadsTo: shipped?.transitions[0]?.target ?? stuckStateOf(config) }];
		}),
	);

/** The state a timed-out wait goes to unless it ships its own timeout: the kind's first stuck state. */
const stuckStateOf = (config: Kind): string | undefined => Object.entries(config.machine.states).find(([, node]) => node.tags?.includes(STUCK_TAG))?.[0];

/**
 * The kinds with a timeout on every wait: the hours answered, else the proposed hours. A wait that ships a timeout keeps
 * where it leads and takes the answered hours; any other timed-out wait ends stuck. A wait with an xstate `timeout`
 * keeps it as it is. A kind with no stuck state stays as it is, so the config check refuses its waits.
 */
export const withTimeouts = (kinds: Readonly<Record<string, Kind>>, answers: WaitAnswers): Record<string, Kind> =>
	Object.fromEntries(
		Object.entries(kinds).map(([kind, config]) => {
			const stuck = stuckStateOf(config);

			if (stuck === undefined) return [kind, config];

			const hoursOf = new Map(waitsOf({ [kind]: config }).map((wait) => [wait.state, answers[waitKey(wait)] ?? wait.hours]));

			const states = Object.entries(config.machine.states).map(([state, node]): [string, StateNodeJSON] => {
				const hours = hoursOf.get(state);

				return [state, hours === undefined || node.timeout !== undefined ? node : { ...node, after: { [String(hours * HOUR_MS)]: earliestTimeout(node)?.transitions ?? [{ target: stuck }] } }];
			});

			return [kind, { ...config, machine: { ...config.machine, states: Object.fromEntries(states) } }];
		}),
	);
