import { ADAPTER_API_VERSION, type Item, type RequestKind, type WorkSource } from "../adapter-api.ts";
import { onceCalls } from "../adapters/once.ts";
import { requestsAllowed } from "../config/machine.ts";
import type { Kind } from "../config/schema.ts";
import { decideRequest, isCurrent, pendingRequest, requestReplyStem, requestReplyText, requestsOn, type RequestStand, type ThreadRequest } from "../decide/request.ts";
import type { SavedSnapshot } from "../state/items.ts";
import type { State } from "../state/open.ts";
import type { SettledRequest } from "../state/saved.ts";
import { dropWaitingQuestions } from "./questions.ts";
import { hasReplyOn } from "./thread.ts";

export type RequestContext = { readonly state: State; readonly workSource: WorkSource; readonly now: () => number };

const keyOf = (item: string, ordinal: number): string => `${item}#${ordinal}`;

/** Where an item stands for its requests: the step its saved state is at under `kind`, and what the owner may ask there. */
export const standOf = (kind: Kind | undefined, saved: SavedSnapshot | undefined, { answered, parked }: Pick<RequestStand, "answered" | "parked">): RequestStand => ({
	at: saved?.state,
	savedAt: saved?.savedAt,
	controls: kind === undefined ? { skip: false, runNow: false } : requestsAllowed(kind, saved?.state),
	answered,
	parked,
});

/** The request that acts on the item now, from the dispositions `state` saved, with no call. */
export const savedPendingRequest = (state: Pick<State, "requests">, item: Item, stand: RequestStand): RequestKind | undefined =>
	pendingRequest(requestsOn(item.thread), ({ ordinal }) => state.requests.get(keyOf(item.id, ordinal)), stand);

const recordOf = (item: string, { ordinal, entry }: ThreadRequest, settled: Pick<SettledRequest, "disposition" | "why">, at: number): SettledRequest => ({
	item,
	ordinal,
	kind: entry.kind,
	step: entry.step,
	...settled,
	at,
});

/**
 * Every request on the item's thread is saved with what became of it, once, and gets one reply: applied, or refused
 * and why. Returns the request that acts on the item now; one that acts drops the question the daily cap still holds
 * for the wait it ends.
 */
export const settleRequests = async (ctx: RequestContext, item: Item, stand: RequestStand): Promise<RequestKind | undefined> => {
	const calls = onceCalls({ apiVersion: ADAPTER_API_VERSION, workSource: ctx.workSource }, ctx.state.ops, { run: "request-reply", attempt: 0 });
	let earlierApplies = false;

	for (const request of requestsOn(item.thread)) {
		const key = keyOf(item.id, request.ordinal);
		const saved = ctx.state.requests.get(key);
		const record: SettledRequest = saved ?? recordOf(item.id, request, decideRequest(request, stand, earlierApplies), ctx.now());

		if (record !== saved) ctx.state.requests.put(key, record);

		earlierApplies ||= record.disposition === "applied" && isCurrent(request, stand);

		if (!hasReplyOn(item.thread, requestReplyStem(request.ordinal, record))) await calls.workSource?.comment(item.id, requestReplyText(request.ordinal, record));
	}

	const pending = savedPendingRequest(ctx.state, item, stand);

	if (pending !== undefined) dropWaitingQuestions(ctx.state, item.id);

	return pending;
};
