import { type AnyActorLogic, type AnyStateMachine, createAsyncLogic, machineFromJSON } from "xstate";
import { toDirectedGraph } from "xstate/graph";
import { z } from "zod";
import { HOUR_MS } from "../time.ts";
import type { Json } from "./json.ts";
import { type Interaction, isFixedPart, type Kind, STUCK_TAG, type StateNodeJSON } from "./schema.ts";

const placeholder = createAsyncLogic({ run: async () => {} });

/** The paths the item's change touches as its machine runs: what a `touches` guard reads. */
export type Touched = () => readonly string[];

/** Where no run is at hand, a guard has no change to read: the machine is broken, and the guard throws rather than pass or fail. */
const noChange: Touched = () => {
	throw new Error("a guard read the change's paths where no run is at hand");
};

/** The guards a kind's transition may name, by the params each takes. */
export const GUARD_PARAMS = {
	/** Passes when the change touches a path one of `paths` matches. */
	touches: z.strictObject({ paths: z.array(z.string().min(1)).min(1) }),
	/** Passes where a run can talk with the owner: hum's runs are Rail rows the owner sees. */
	talks: z.undefined(),
} as const;

/** What a kind's guards read as its machine runs: the paths the change touches, and whether a run can talk with the owner. */
export type MachineReads = { readonly touched: Touched; readonly talks: boolean };

/** Where no run is at hand: no change to read, and no run that talks. */
const NO_RUN: MachineReads = { touched: noChange, talks: false };

/** The guards' implementations, reading the change and the runs through `reads`. */
const guardsOf = ({ touched, talks }: MachineReads) => ({
	touches: (_: { readonly event: { readonly type: string } }, params: Json): boolean => {
		const { paths } = GUARD_PARAMS.touches.parse(params);

		return touched().some((path) => paths.some((glob) => new Bun.Glob(glob).match(path)));
	},
	talks: (): boolean => talks,
});

/** What a run past its token cap, or a run's question for the owner, sends the machine. */
export const TOKEN_CAP = "token-cap";

/** What the owner's answer sends the wait it was given at. */
export const ANSWERED = "answered";

/** What the owner's approval of a change sends the wait for it. */
export const OWNER_APPROVED = "owner-approved";

/** What the owner's answer other than approval sends the wait for a change's approval. */
export const OWNER_REJECTED = "owner-rejected";

/** What the owner's skip sends a state its kind file lets them skip. The engine adds the transition, so no hum.json names it. */
export const SKIP = "skip";

/** What the state offers the owner, where it waits on them. */
export const interactionAt = (kind: Kind, state: string | undefined): Interaction | undefined => (state === undefined ? undefined : kind.machine.states[state]?.meta?.interaction);

/** Whether the state waits on the owner: it offers them an interaction. */
export const isOwnerWait = (node: StateNodeJSON | undefined): boolean => node?.meta?.interaction !== undefined;

/** Whether the item waits on the owner in this state. */
export const isWaitingOnOwner = (kind: Kind, state: string | undefined): boolean => state !== undefined && isOwnerWait(kind.machine.states[state]);

/** Where the owner's skip takes the state: only a wait on the owner, which a pass restores, skips; undefined where the state does not. */
export const skipTargetOf = (node: StateNodeJSON | undefined): string | undefined => (isOwnerWait(node) ? node?.meta?.skip?.target : undefined);

/** Whether the owner may run the state's timer now: a wait on the owner whose earliest `after` timeout leads to no stuck state, so running it moves the item on to work. */
const canRunNow = (kind: Kind, node: StateNodeJSON | undefined): boolean => {
	const [earliest] = timeoutsOf(node);
	const isStuck = (state: string): boolean => kind.machine.states[state]?.tags?.includes(STUCK_TAG) ?? false;

	return isOwnerWait(node) && earliest !== undefined && !targetsOf([earliest.transitions].flat()).some(isStuck);
};

/** The requests the item's state lets the owner make: a skip, and running its timer now. */
export const requestsAllowed = (kind: Kind, state: string | undefined) => {
	const node = state === undefined ? undefined : kind.machine.states[state];

	return { skip: skipTargetOf(node) !== undefined, runNow: canRunNow(kind, node) };
};

/** Whether the state waits for the owner's approval of a change: one of its options sends that approval. */
export const isApprovalWait = (kind: Kind, state: string | undefined): boolean => interactionAt(kind, state)?.choices?.some(({ event }) => event.type === OWNER_APPROVED) ?? false;

/**
 * The kind as hum runs it. A state that invokes a role's run and names no `token-cap` transition stops, past the cap,
 * at the wait `<overCap>-<state>`: the kind's own state of that name, else a copy of its `tokenCap.overCap` wait whose
 * answer leads back to the state, so the owner's answer runs it again and skips nothing after it.
 */
export const withOverCapWaits = (kind: Kind): Kind => {
	const { machine, tokenCap } = kind;
	const wait = machine.states[tokenCap.overCap];

	if (wait === undefined) return kind;

	const waitOf = (run: string): string => `${tokenCap.overCap}-${run}`;

	const runs = Object.entries(machine.states)
		.filter(([, node]) => node.invoke !== undefined && !isFixedPart(node.invoke.src) && node.on?.[TOKEN_CAP] === undefined)
		.map(([name]) => name);

	const states = Object.fromEntries(Object.entries(machine.states).map(([name, node]) => [name, runs.includes(name) ? { ...node, on: { ...node.on, [TOKEN_CAP]: [{ target: waitOf(name) }] } } : node]));
	const waits = Object.fromEntries(runs.map((run) => [waitOf(run), machine.states[waitOf(run)] ?? { ...wait, on: { ...wait.on, [ANSWERED]: [{ target: run }] } }]));

	return { ...kind, machine: { ...machine, states: { ...states, ...waits } } };
};

/** The kind with the skip transition on each state the owner may skip; a state's own `skip` transition stays, and the config check refuses it. */
export const withSkips = (kind: Kind): Kind => {
	const skipped = ([name, node]: [string, StateNodeJSON]): [string, StateNodeJSON] => {
		const target = skipTargetOf(node);

		return [name, target === undefined ? node : { ...node, on: { [SKIP]: [{ target }], ...node.on } }];
	};

	return { ...kind, machine: { ...kind.machine, states: Object.fromEntries(Object.entries(kind.machine.states).map(skipped)) } };
};

/**
 * A kind's machine. `machineFromJSON` needs an actor for every `invoke.src`; any
 * `sources` not given stand in as placeholders, which is enough to check the graph.
 * Its guards read the change and the runs through `reads`; a guard that reads the change throws where none is given.
 * Throws with xstate's message when the machine is illegal.
 */
export const kindMachine = (kind: Kind, sources: Readonly<Record<string, AnyActorLogic>> = {}, reads: MachineReads = NO_RUN): AnyStateMachine => {
	// SAFETY: the zod machine schema is a subset of xstate's MachineJSON, and machineFromJSON validates the rest.
	return machineFromJSON(kind.machine as Parameters<typeof machineFromJSON>[0], { actors: invokedSources(kind, placeholder, sources), guards: guardsOf(reads) });
};

/** A state's `after` timeouts, shortest first: each one's delay in ms and the transitions it takes. */
export const timeoutsOf = (node: StateNodeJSON | undefined): { readonly ms: number; readonly transitions: NonNullable<StateNodeJSON["after"]>[string] }[] =>
	Object.entries(node?.after ?? {})
		.map(([delay, transitions]) => ({ ms: Number(delay), transitions }))
		.sort((a, b) => a.ms - b.ms);

/** A state's earliest `after` timeout: its hours and the transitions it takes; undefined for a state with none. */
export const earliestTimeout = (node: StateNodeJSON | undefined) => {
	const [earliest] = timeoutsOf(node);

	return earliest && { hours: earliest.ms / HOUR_MS, transitions: earliest.transitions };
};

/** An actor for each source the kind's machine invokes: the one `sources` gives, else `fallback`. */
export const invokedSources = (kind: Kind, fallback: AnyActorLogic, sources: Readonly<Record<string, AnyActorLogic>> = {}): Record<string, AnyActorLogic> =>
	Object.fromEntries(Object.values(kind.machine.states).flatMap(({ invoke }) => (invoke ? [[invoke.src, sources[invoke.src] ?? fallback]] : [])));

/** Every transition a state holds, wherever it holds one. */
export const transitionsOf = (node: StateNodeJSON) =>
	[...Object.values(node.on ?? {}), ...Object.values(node.after ?? {}), node.always ?? [], node.onTimeout ?? [], node.invoke?.onDone ?? [], node.invoke?.onError ?? []].flat();

const targetsOf = (transitions: ReturnType<typeof transitionsOf>): string[] => transitions.flatMap(({ target }) => (target === undefined ? [] : [target]));

/** The waits a run stops at past its token cap: the states only the over-cap event leads to. */
export const overCapWaits = (kind: Kind): ReadonlySet<string> => {
	const nodes = Object.values(kind.machine.states);
	const capped = new Set(nodes.flatMap((node) => targetsOf(node.on?.[TOKEN_CAP] ?? [])));
	const otherwise = new Set(nodes.flatMap(({ on = {}, ...node }) => targetsOf(transitionsOf({ ...node, on: Object.fromEntries(Object.entries(on).filter(([event]) => event !== TOKEN_CAP)) }))));

	return new Set([...capped].filter((state) => !otherwise.has(state)));
};

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
