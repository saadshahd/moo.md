import { copyFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { savedLimitUntil, settleLimit } from "../adapters/limit.ts";
import { nextStates, reachedFrom } from "../config/machine.ts";
import { type Config } from "../config/load.ts";
import { type Kind, OWNER_WAIT_TAG } from "../config/schema.ts";
import type { State } from "../state/open.ts";
import { queuedKey } from "../worker/questions.ts";

/** Where publish found an item's saved machine state before the work job ran, and whether the owner had answered. */
export type InboxItem = {
	readonly item: string;
	readonly kind: Kind;
	/** The machine's state in the inbox, or undefined when the item had none. */
	readonly at: string | undefined;
	/** The inbox thread holds the owner's answer to the wait the item is in. */
	readonly answered: boolean;
};

const isOwnerWait = (kind: Kind, state: string): boolean => kind.machine.states[state]?.tags?.includes(OWNER_WAIT_TAG) ?? false;

/**
 * The states one pass may carry an item to from where the inbox saved it: through every transition of its kind's
 * machine, past the owner's wait it starts in only with the owner's answer, and never past another owner's wait.
 */
export const passReach = ({ kind, at, answered }: Omit<InboxItem, "item">): ReadonlySet<string> => {
	const start = at ?? kind.machine.initial;

	return reachedFrom(start, nextStates(kind), (state) => !isOwnerWait(kind, state) || (state === start && answered));
};

/** The rank of a kind's floor among the levels; a kind with no floor ranks lowest. */
const floorRank = (config: Config, kind: string): number => {
	const floor = config.hum.kindFloors[kind];

	return floor === undefined ? -1 : config.hum.levels.findIndex(({ name }) => name === floor);
};

/** A work job may move an item to another kind only where that kind's risk floor is no lower. */
export const mayMoveKind = (config: Config, { from, to }: { readonly from: string; readonly to: string }): boolean => floorRank(config, to) >= floorRank(config, from);

/**
 * Takes into publish's state what a work job wrote for one item it ran, and nothing else: the item's machine state
 * when it is one a pass can reach from the inbox's, its runs, its spend, its plan, its pull request text, its proof,
 * the questions it queued, its choices, its events, its cards and the usage limit. Landings, verdicts, merges, learned rules, kinds, answers
 * and op keys stay as publish has them. Returns why the machine state was refused, or nothing once all is taken.
 */
export const takeWorkRecords = (work: State, into: State, inbox: InboxItem): string | undefined => {
	const { item, kind } = inbox;
	const saved = work.items.saved().find(({ itemId }) => itemId === item);

	if (saved !== undefined) {
		if (saved.kind !== kind.machine.id || saved.machineVersion !== kind.machine.version) return `the work job saved ${item} under ${saved.kind}@${saved.machineVersion}, not ${kind.machine.id}@${kind.machine.version}`;

		if (saved.state === undefined || !passReach(inbox).has(saved.state)) return `no pass takes ${item} from ${inbox.at ?? kind.machine.initial} to ${saved.state ?? "a nested state"}`;

		mkdirSync(dirname(into.items.path(item)), { recursive: true });
		copyFileSync(work.items.path(item), into.items.path(item));
	} else into.items.remove(item);

	for (const record of work.runs.list(item)) into.runs.keep(record);

	work.spent.copyTo(into.spent, item);
	work.plans.copyTo(into.plans, item);
	work.pullRequests.copyTo(into.pullRequests, item);
	work.proofs.copyTo(into.proofs, item);

	for (const queued of work.questions.list().filter((queued) => queued.item === item && queued.askedAt === undefined)) into.questions.put(queuedKey(queued), queued);

	for (const choice of work.choices.list().filter((choice) => choice.item === item)) into.choices.put(`${item}@${choice.text}`, choice);

	for (const event of work.events.list(item)) into.events.add(event);

	for (const { code, cause, fix, action } of work.faults.list().filter((card) => card.item === item)) into.faults.raise({ code, item, cause, fix, action });

	const until = savedLimitUntil(work);

	if (until > 0) settleLimit(into, { kind: "limited", until });

	return undefined;
};
