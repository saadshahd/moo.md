import { ADAPTER_API_VERSION, type Item, type Questions, type RequestKind, type WorkSource } from "../adapter-api.ts";
import { onceCalls } from "../adapters/once.ts";
import { requestsAllowed } from "../config/machine.ts";
import type { Kind } from "../config/schema.ts";
import { decideRequest, isCurrent, type KeptRequest, keptRequestOf, pendingRequest, requestReplyStem, requestReplyText, requestsOn, type RequestStand, requestWait } from "../decide/request.ts";
import type { SavedSnapshot } from "../state/items.ts";
import type { State } from "../state/open.ts";
import type { SettledRequest } from "../state/saved.ts";
import { endWait } from "./questions.ts";
import { keepAnswer, keptAnswer } from "./owner-answers.ts";
import { hasReplyOn } from "./thread.ts";

export type RequestContext = { readonly state: State; readonly workSource: WorkSource; readonly questions: Questions; readonly now: () => number };

const keyOf = (item: string, ordinal: number): string => `${item}#${ordinal}`;

/** Where an item stands for its requests: the step its saved state is at under `kind`, and what the owner may ask there. */
export const standOf = (kind: Kind | undefined, saved: SavedSnapshot | undefined, { answered, parked }: Pick<RequestStand, "answered" | "parked">): RequestStand => ({
	at: saved?.state,
	savedAt: saved?.savedAt,
	controls: kind === undefined ? { skip: false, runNow: false } : requestsAllowed(kind, saved?.state),
	answered,
	parked,
});

/** The requests on the item's thread that its log keeps, read as the owner made them. */
const keptRequests = (state: Pick<State, "events">, item: Item): KeptRequest[] =>
	requestsOn(item.thread).flatMap(({ ordinal, entry }) => {
		const kept = keptAnswer(state.events, item.id, entry);

		return kept === undefined ? [] : [keptRequestOf(ordinal, kept)];
	});

/** The request that acts on the item now, from the requests its log keeps and the dispositions `state` saved, with no call. */
export const savedPendingRequest = (state: Pick<State, "requests" | "events">, item: Item, stand: RequestStand): RequestKind | undefined =>
	pendingRequest(keptRequests(state, item), ({ ordinal }) => state.requests.get(keyOf(item.id, ordinal)), stand);

const recordOf = (item: string, { ordinal, kind, wait }: KeptRequest, settled: Pick<SettledRequest, "disposition" | "why">, at: number): SettledRequest => ({
	item,
	ordinal,
	kind,
	step: wait?.step,
	...settled,
	at,
});

/**
 * Every request on the item's thread is read once into the owner's answer its log keeps, saved with what became of
 * it, once, and gets one reply: applied, or refused and why. Returns the request that acts on the item now; one that acts ends the wait it stands in.
 */
export const settleRequests = async (ctx: RequestContext, item: Item, stand: RequestStand): Promise<RequestKind | undefined> => {
	const calls = onceCalls({ apiVersion: ADAPTER_API_VERSION, workSource: ctx.workSource }, ctx.state.ops, { run: "request-reply", attempt: 0 });
	let earlierApplies = false;

	for (const { ordinal, entry } of requestsOn(item.thread)) {
		const request = keptRequestOf(ordinal, await keepAnswer(ctx.state.events, item.id, entry, () => ({ wait: requestWait(entry, stand), choice: entry.kind, read: "marker" })));
		const key = keyOf(item.id, request.ordinal);
		const saved = ctx.state.requests.get(key);
		const record: SettledRequest = saved ?? recordOf(item.id, request, decideRequest(request, stand, earlierApplies), ctx.now());

		if (record !== saved) ctx.state.requests.put(key, record);

		earlierApplies ||= record.disposition === "applied" && isCurrent(request, stand);

		if (!hasReplyOn(item.thread, requestReplyStem(request.ordinal, record))) await calls.workSource?.comment(item.id, requestReplyText(request.ordinal, record));
	}

	const pending = savedPendingRequest(ctx.state, item, stand);

	if (pending !== undefined) await endWait(ctx, item, pending);

	return pending;
};
