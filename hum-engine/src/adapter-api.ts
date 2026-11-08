import { z } from "zod";
import type { FaultInput } from "./state/faults.ts";

export type { FaultInput };

/** Bumped on every change to the API an adapter implements; a breaking change bumps the engine's major version. */
export const ADAPTER_API_VERSION = 1;

/** Failure that retrying cannot fix: a reply of the wrong shape, a refused push. The engine surfaces it at once. */
export class PermanentError extends Error {
	override name: string = "PermanentError";
}

/** The most characters an item id holds. */
export const ITEM_ID_LENGTH = 100;

const ITEM_ID_MESSAGE = "an item id is letters, digits, dot, dash or underscore";

/** An item id is safe as a file name and as a git ref component. */
export const ItemId = z
	.string()
	.max(ITEM_ID_LENGTH, ITEM_ID_MESSAGE)
	.regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, ITEM_ID_MESSAGE)
	.refine((id) => !id.includes("..") && !id.endsWith(".lock"), "an item id has no '..' and does not end in '.lock'");

export type ItemId = z.infer<typeof ItemId>;

const text = z.string().min(1);
const time = z.int().nonnegative();

export const THREAD_KINDS = ["comment", "question", "answer", "decision"] as const;

/** One entry on an item's thread, oldest first. */
export const ThreadEntry = z.strictObject({
	kind: z.enum(THREAD_KINDS),
	text,
	at: time,
	option: text.optional(),
});

export type ThreadEntry = z.infer<typeof ThreadEntry>;

export const ItemRef = z.strictObject({ id: ItemId, title: text });

export type ItemRef = z.infer<typeof ItemRef>;

export const Item = ItemRef.extend({
	body: z.string(),
	/** True while the source lists the item as ready to claim. */
	ready: z.boolean(),
	thread: z.array(ThreadEntry),
	/** Names the source tags the item with: its labels, or a markdown item's `kind`. One that names a kind sets the item's kind. */
	labels: z.array(text).optional(),
});

export type Item = z.infer<typeof Item>;

export const Claim = z.strictObject({ item: ItemId, holder: text, expiresAt: time });

export type Claim = z.infer<typeof Claim>;

/** `claim` holds the winner: the caller on `won`, the current holder otherwise. */
export const ClaimResult = z.strictObject({ won: z.boolean(), claim: Claim });

export type ClaimResult = z.infer<typeof ClaimResult>;

/** `changed` is true when `token` differs from the one the caller passed in. */
export const Watch = z.strictObject({ token: text, changed: z.boolean() });

export type Watch = z.infer<typeof Watch>;

export type Question = { readonly text: string; readonly options?: readonly string[] };

export type Answer = { readonly text: string; readonly option?: string };

export type FollowUp = { readonly title: string; readonly body: string };

/** The work source: the queue, the claims and the item threads. */
export interface WorkSource {
	listReady(): Promise<ItemRef[]>;
	read(id: string): Promise<Item>;
	/** An atomic take. An unclaimed or expired item goes to the first caller; the same holder renews. */
	claim(id: string, holder: string, ttlMs: number): Promise<ClaimResult>;
	/** Extends the holder's own claim; `won: false` when another worker holds it now. */
	renew(id: string, holder: string, ttlMs: number): Promise<ClaimResult>;
	comment(id: string, text: string): Promise<void>;
	/** Files a ready item. Filing the same `title` from the same `from` twice returns the first item. */
	fileFollowUp(from: string, followUp: FollowUp): Promise<ItemRef>;
}

/** Where a run's questions and the choices made without the owner land. */
export interface Questions {
	ask(id: string, question: Question): Promise<void>;
	/** Records a choice made without the owner. */
	decide(id: string, text: string): Promise<void>;
}

/** Where the owner's answers arrive. */
export interface Answers {
	answer(id: string, answer: Answer): Promise<void>;
	/** The one cheap read: has anything changed since `since`. An idle call costs no rate limit. */
	watch(since?: string): Promise<Watch>;
}

export interface Release {
	/** Puts the item's artifact where reviewers see it. */
	publish(id: string, ref: string): Promise<void>;
	/** Ships a published artifact. */
	release(id: string, ref: string): Promise<void>;
}

/** An adapter declares the API version it implements and the integrations it provides. */
export type Adapter = {
	readonly apiVersion: number;
	readonly workSource?: WorkSource;
	readonly questions?: Questions;
	readonly answers?: Answers;
	readonly release?: Release;
};

export type AdapterContext = {
	/** Raise a fault card, scoped to one item or provider. */
	readonly report: (fault: FaultInput) => void;
	readonly now: () => number;
};

/** The default export of an owner's `adapters/<name>.ts`. */
export type AdapterFactory = (context: AdapterContext) => Adapter | Promise<Adapter>;
