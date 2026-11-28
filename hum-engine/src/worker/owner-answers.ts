import type { ThreadEntry } from "../adapter-api.ts";
import { hashJson } from "../config/hash.ts";
import { asJson } from "../config/json.ts";
import type { EventLog, KeptAnswer, Wait } from "../state/events.ts";
import type { SavedSnapshot } from "../state/items.ts";
import type { Parked } from "../state/saved.ts";

/** The source every owner's answer is kept under in an item's log. */
const OWNER_SOURCE = "owner";

/** The key an owner's entry is kept under: its source's own id, else the hash of the entry as its source gave it. */
export const answerKey = (entry: ThreadEntry): string => entry.id ?? hashJson(asJson(entry));

/** The wait of an item saved at a step: that step, entered when the item was saved there. */
export const waitOf = ({ state, savedAt }: Pick<SavedSnapshot, "state" | "savedAt">): Wait => ({ step: state, since: savedAt });

/** The wait of a parked item: its card, raised when it parked. */
export const parkedWait = ({ why, since }: Pick<Parked, "why" | "since">): Wait => ({ step: `parked:${why}`, since });

/** The wait an answer given `at` was given at, where the item is in `wait` when hum first reads it: that visit only where the answer came during it. */
export const givenAt = (wait: Wait | undefined, at: number): Wait | undefined => {
	if (wait === undefined) return undefined;

	return wait.since !== undefined && at >= wait.since ? wait : { step: wait.step };
};

/** Whether the answer was given at `wait`: the same step, at the same visit to it. */
export const isGivenAt = (answer: KeptAnswer | undefined, wait: Wait): boolean =>
	answer?.wait !== undefined && answer.wait.step === wait.step && answer.wait.since !== undefined && answer.wait.since === wait.since;

/** What reading an owner's entry settles, beside the words and the time its source gave. */
export type Reading = Pick<KeptAnswer, "wait" | "choice" | "read">;

/** The owner's answer the item's log keeps for the entry, if hum has read it. */
export const keptAnswer = (events: EventLog, itemId: string, entry: ThreadEntry): KeptAnswer | undefined => {
	const found = events.find({ itemId, source: OWNER_SOURCE, sourceId: answerKey(entry) });

	if (found !== undefined && found.type !== "answered") throw new Error(`the log of ${itemId} keeps a ${found.type} under an owner's answer key`);

	return found?.payload;
};

/**
 * The owner's answer the item's log keeps for the entry, read by `read` and kept the first time hum meets it, so the
 * source's text is read once and every later decision reads the kept answer.
 */
export const keepAnswer = async (events: EventLog, itemId: string, entry: ThreadEntry, read: () => Reading | Promise<Reading>): Promise<KeptAnswer> => {
	const kept = keptAnswer(events, itemId, entry);

	if (kept !== undefined) return kept;

	const { event } = events.add({ itemId, source: OWNER_SOURCE, sourceId: answerKey(entry), type: "answered", payload: { ...(await read()), text: entry.text, at: entry.at } });

	if (event.type !== "answered") throw new Error(`the log of ${itemId} keeps a ${event.type} under an owner's answer key`);

	return event.payload;
};
