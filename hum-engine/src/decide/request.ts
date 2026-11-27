import { z } from "zod";
import { NOTE_KIND, type OwnerRequest, REQUEST_KINDS, type RequestKind, type ThreadEntry } from "../adapter-api.ts";
import type { KeptAnswer, Wait } from "../state/events.ts";
import type { Controls, Status } from "../status/format.ts";
import { unreachableNote } from "./note.ts";

/** What became of a request: it acts on the item, or it is refused and the thread says why. */
export const REQUEST_DISPOSITIONS = ["applied", "refused"] as const;

export type RequestDisposition = { readonly disposition: (typeof REQUEST_DISPOSITIONS)[number]; readonly why: string };

/** The requests a step lets the owner make, as its status row lists them. */
export type RequestControls = Pick<Controls, "skip" | "runNow">;

type RequestRule = { readonly control: keyof RequestControls; readonly refused: (step: string) => string; readonly applied: (step: string) => string };

/** Each kind of request: the control the step must offer for it, why a step without it refuses it, and what it does once applied. */
const REQUEST_RULES = {
	skip: {
		control: "skip",
		refused: (step) => `${step} is not a step the owner may skip: hum skips only a wait on the owner whose kind file gives it meta.skip`,
		applied: (step) => `the item leaves ${step} where its kind file's skip leads`,
	},
	"run-now": {
		control: "runNow",
		refused: (step) => `${step} has no timer the owner may run: hum runs only the earliest timer of a wait on the owner, and only where it leads on to work, never to a stuck step`,
		applied: (step) => `the timer of ${step} fires now`,
	},
} as const satisfies Record<RequestKind, RequestRule>;

/** Where an item stands for a request: the step it is at, and the requests that step allows. */
export type RequestScope = { readonly at: string | undefined; readonly controls: RequestControls };

/** Why a request may not act where the item stands, or undefined where it may: it names the step the item is at, and that step allows it. */
export const requestRefusal = ({ kind, step }: { readonly kind: RequestKind; readonly step: string }, { at, controls }: RequestScope): string | undefined => {
	if (at === undefined) return "the item has no saved step";

	if (at !== step) return `the item is at ${at} now, not ${step}`;

	const rule = REQUEST_RULES[kind];

	return controls[rule.control] ? undefined : rule.refused(step);
};

/**
 * Why the item's row in the local status file refuses a request or a note before it is written, or undefined where it
 * lets it go on to the worker: a note goes only to a step the row lists under `noteTo`. Where no row names the item, as
 * where its state lives only in CI, the worker's check alone decides.
 */
export const statusRefusal = (request: OwnerRequest, item: string, open: Status["open"]): string | undefined => {
	const row = open.find((found) => found.item === item);

	if (row === undefined) return undefined;

	if (request.kind === NOTE_KIND) return row.controls.noteTo.includes(request.step) ? undefined : unreachableNote(request.step, row.at);

	return requestRefusal(request, row);
};

/** Where an item stands for the requests on its thread, as its saved state says. */
export type RequestStand = RequestScope & {
	/** When the item was saved at its step: a request made before then was made before this visit. */
	readonly savedAt: number | undefined;
	/** The owner's answer released the wait the item is at. */
	readonly answered: boolean;
	readonly parked: boolean;
};

/** One request on an item's thread, with its number among the thread's requests. */
export type ThreadRequest = { readonly ordinal: number; readonly entry: ThreadEntry & { readonly kind: RequestKind } };

const REQUEST_KIND_SET: ReadonlySet<string> = new Set(REQUEST_KINDS);

const isRequest = (entry: ThreadEntry): entry is ThreadRequest["entry"] => REQUEST_KIND_SET.has(entry.kind);

/** Every request on the thread, numbered in the order they were made. */
export const requestsOn = (thread: readonly ThreadEntry[]): ThreadRequest[] => {
	const requests: ThreadRequest[] = [];

	for (const entry of thread) if (isRequest(entry)) requests.push({ ordinal: requests.length + 1, entry });

	return requests;
};

/** The wait a request on the thread was made at: the step it names, at the item's visit to it where it came during the visit the item is at now; none where it names no step. */
export const requestWait = ({ step, at: madeAt }: ThreadEntry, { at, savedAt }: Pick<RequestStand, "at" | "savedAt">): Wait | undefined => {
	if (step === undefined) return undefined;

	return step === at && savedAt !== undefined && madeAt >= savedAt ? { step, since: savedAt } : { step };
};

/** One request as the item's log keeps it, with its number among the thread's requests. */
export type KeptRequest = { readonly ordinal: number; readonly kind: RequestKind; readonly wait?: Wait };

const RequestChoice = z.enum(REQUEST_KINDS);

/** The request an owner's kept answer makes: its choice names the request's kind. */
export const keptRequestOf = (ordinal: number, { choice, wait }: Pick<KeptAnswer, "choice" | "wait">): KeptRequest => ({ ordinal, kind: RequestChoice.parse(choice), wait });

/** Whether the request was made at the item's visit to the step it is at now. */
export const isCurrent = ({ wait }: KeptRequest, { at, savedAt }: Pick<RequestStand, "at" | "savedAt">): boolean => at !== undefined && wait?.step === at && wait.since !== undefined && wait.since === savedAt;

const refused = (why: string): RequestDisposition => ({ disposition: "refused", why });

/** What becomes of a request no saved record settles yet; `earlierApplies` once an earlier request made at this visit applies. */
export const decideRequest = (request: KeptRequest, stand: RequestStand, earlierApplies: boolean): RequestDisposition => {
	const { kind } = request;
	const step = request.wait?.step;

	if (step === undefined) return refused("it names no step");

	if (stand.parked) return refused("the item is parked: act on its card first");

	if (step === stand.at && !isCurrent(request, stand)) return refused(`the item came to ${step} after this request`);

	const refusal = requestRefusal({ kind, step }, stand);

	if (refusal !== undefined) return refused(refusal);

	if (stand.answered) return refused(`the owner's answer at ${step} came first`);

	if (earlierApplies) return refused(`an earlier request at ${step} applies`);

	return { disposition: "applied", why: REQUEST_RULES[kind].applied(step) };
};

/** The request that acts on the item now: the first one settled applied that was made at this visit, where no answer released the wait first. */
export const pendingRequest = (requests: readonly KeptRequest[], settled: (request: KeptRequest) => RequestDisposition | undefined, stand: RequestStand): RequestKind | undefined =>
	stand.answered ? undefined : requests.find((request) => isCurrent(request, stand) && settled(request)?.disposition === "applied")?.kind;

/** The stem a request's reply opens with, which finds it again on the thread. */
export const requestReplyStem = (ordinal: number, { disposition }: RequestDisposition): string => `Request ${ordinal} ${disposition}:`;

/** The reply posted on the thread for a request. */
export const requestReplyText = (ordinal: number, outcome: RequestDisposition): string => `${requestReplyStem(ordinal, outcome)} ${outcome.why}.`;
