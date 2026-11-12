import { z } from "zod";
import type { Env } from "./exec.ts";
import type { FaultInput } from "./state/faults.ts";

export type { FaultInput };

/** Bumped on every change to the API an adapter implements; a breaking change bumps the engine's major version. */
export const ADAPTER_API_VERSION = 2;

/** Failure that retrying cannot fix: a reply of the wrong shape, a refused push. The engine surfaces it at once, as it does a `failed: "now"` answer. */
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
	.refine((id) => !id.includes("..") && !id.endsWith(".lock"), "an item id has no '..' and does not end in '.lock'")
	.brand<"ItemId">();

export type ItemId = z.infer<typeof ItemId>;

/** Who holds a claim: a plain name, never an item id. */
export const Holder = z
	.string()
	.regex(/^[A-Za-z0-9][\w.@:-]{0,99}$/, "a holder is a plain name: letters, digits and . _ @ : -")
	.brand<"Holder">();

export type Holder = z.infer<typeof Holder>;

const text = z.string().min(1);
const time = z.int().nonnegative();

export const THREAD_KINDS = ["comment", "question", "answer", "decision"] as const;

/** Who wrote a thread entry: hum, which marks its comments, or a person typing without a marker. */
export const THREAD_AUTHORS = ["hum", "person"] as const;

/** One entry on an item's thread, oldest first. */
export const ThreadEntry = z.strictObject({
	kind: z.enum(THREAD_KINDS),
	text,
	at: time,
	option: text.optional(),
	/** A source that cannot tell leaves it out, and the entry reads as hum's. */
	author: z.enum(THREAD_AUTHORS).optional(),
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

export const Claim = z.strictObject({ item: ItemId, holder: Holder, expiresAt: time });

export type Claim = z.infer<typeof Claim>;

/** `claim` holds the winner: the caller on `won`, the current holder otherwise. */
export const ClaimResult = z.strictObject({ won: z.boolean(), claim: Claim });

export type ClaimResult = z.infer<typeof ClaimResult>;

/** `changed` is true when `token` differs from the one the caller passed in. */
export const Watch = z.strictObject({ token: text, changed: z.boolean() });

export type Watch = z.infer<typeof Watch>;

/** `detail` rides folded on the thread, for agents; the owner reads `text` alone. */
export type Question = { readonly text: string; readonly options?: readonly string[]; readonly detail?: string };

export type Answer = { readonly text: string; readonly option?: string };

export type FollowUp = { readonly title: string; readonly body: string };

/** The work source: the queue, the claims and the item threads. */
export interface WorkSource {
	listReady(): Promise<ItemRef[]>;
	read(id: ItemId): Promise<Item>;
	/** An atomic take. An unclaimed or expired item goes to the first caller; the same holder renews. */
	claim(id: ItemId, holder: Holder, ttlMs: number): Promise<ClaimResult>;
	/** Extends the holder's own claim; `won: false` when another worker holds it now. */
	renew(id: ItemId, holder: Holder, ttlMs: number): Promise<ClaimResult>;
	comment(id: ItemId, text: string): Promise<void>;
	/** Files a ready item. Filing the same `title` from the same `from` twice returns the first item. */
	fileFollowUp(from: ItemId, followUp: FollowUp): Promise<ItemRef>;
}

/** Where a run's questions and the choices made without the owner land. */
export interface Questions {
	ask(id: ItemId, question: Question): Promise<void>;
	/** Records a choice made without the owner. */
	decide(id: ItemId, text: string): Promise<void>;
}

/** Where the owner's answers arrive. */
export interface Answers {
	answer(id: ItemId, answer: Answer): Promise<void>;
	/** The one cheap read: has anything changed since `since`. An idle call costs no rate limit. */
	watch(since?: string): Promise<Watch>;
}

export interface Release {
	/** Puts the item's artifact where reviewers see it. */
	publish(id: ItemId, ref: string): Promise<void>;
	/** Ships a published artifact. */
	release(id: ItemId, ref: string): Promise<void>;
}

export const FAILED_KINDS = ["retry", "now"] as const;

/**
 * A call an adapter could not complete, answered in place of its value. `retry`: a later attempt may work, and the
 * engine tries again within the provider timeout. `now`: no attempt will, and the engine raises one card and stops.
 */
export const Failed = z.strictObject({ failed: z.enum(FAILED_KINDS), why: text });

export type Failed = z.infer<typeof Failed>;

/** An integration as an adapter implements it: every call may answer `Failed` in place of its value. */
export type Fallible<I> = { readonly [K in keyof I]: I[K] extends (...args: infer A) => Promise<infer R> ? (...args: A) => Promise<R | Failed> : I[K] };

/** An adapter declares the API version it implements and the integrations it provides. */
export type Adapter = {
	readonly apiVersion: number;
	readonly workSource?: Fallible<WorkSource>;
	readonly questions?: Fallible<Questions>;
	readonly answers?: Fallible<Answers>;
	readonly release?: Fallible<Release>;
};

/** The integrations with plain replies: the engine calls them so behind the guard, which retries or throws on `Failed`, and an adapter that never answers `Failed` may implement them so. */
export type Integrations = {
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
	/** The process environment, for the tokens and addresses an adapter reads. */
	readonly env: Env;
};

/** The default export of an owner's `adapters/<name>.ts`. */
export type AdapterFactory = (context: AdapterContext) => Adapter | Promise<Adapter>;
