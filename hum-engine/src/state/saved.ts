import { z } from "zod";
import { AlignmentAnswer } from "../decide/alignment.ts";
import { DISPOSITIONS, RESOLUTION_SOURCES } from "../decide/answer.ts";
import { Cite, PlanFile } from "../decide/prose.ts";
import { Change } from "../decide/risk.ts";

const name = z.string().min(1);
const time = z.int().nonnegative();

/** Why an item sits out: it ended stuck, or its change waits for the owner's review. Until the owner acts, no run starts for it. */
export const Parked = z.object({ item: name, why: z.enum(["stuck", "review"]), cause: name, since: time });

export type Parked = z.infer<typeof Parked>;

/** Tokens an item has spent over all its runs. The cap counts those after `base`, the total when the owner last answered. */
export const Spent = z.object({ item: name, total: time, base: time });

export type Spent = z.infer<typeof Spent>;

/** Until when every run is held. Saved so a restart makes no call before it. */
export const Limit = z.object({ until: time });

/** The ids a provider last listed as ready, so a restart still sees an empty list that contradicts them. */
export const ReadyList = z.object({ ids: z.array(name) });

/** A finished change on its way to the base: what its diff showed, so a retry lands it again without a run. */
export const Landing = z.object({
	item: name,
	branch: name,
	since: time,
	change: Change,
	/** The commit the change ends at, before hum marks the item done: what a review reads. */
	head: name,
	/** The owner approved this change in its review state, before it was saved. */
	ownerApproved: z.boolean(),
	/** The alignment call's grades, or why it abstained; made once per change. */
	alignment: z.union([z.object({ graded: AlignmentAnswer }), z.object({ abstained: name })]).optional(),
});

export type Landing = z.infer<typeof Landing>;

/** A path rule the owner's answer made, committed on the base; the view lists it with an undo. */
export const Learned = z.object({ glob: name, level: name, item: name, commit: name, pull: name.optional(), at: time });

export type Learned = z.infer<typeof Learned>;

/** The model ids that answered a model-judgment call; the measured record decides later whether they count. */
const models = z.array(name);

/** An item's kind, decided once: named by its source, picked by the model call, or the fallback when the call abstained. */
export const ItemKind = z.discriminatedUnion("from", [
	z.object({ item: name, kind: name, from: z.literal("source") }),
	z.object({ item: name, kind: name, from: z.literal("model") }),
	z.object({ item: name, kind: name, from: z.literal("fallback"), why: name }),
]);

export type ItemKind = z.infer<typeof ItemKind>;

/** The plan a plan run made ready, saved with its hash so later runs read it unchanged. */
export const SavedPlan = z.object({ item: name, plan: PlanFile, hash: name, models });

export type SavedPlan = z.infer<typeof SavedPlan>;

/** A fresh review run's verdict on the change that ends at `head`. */
export const Verdict = z.object({ item: name, head: name, event: name, reason: z.string(), cites: z.array(Cite), models });

export type Verdict = z.infer<typeof Verdict>;

/** A question the run asked, waiting for room under the daily cap until `askedAt` is set; `askedAt` stays to count the day. */
export const QueuedQuestion = z.object({
	item: name,
	text: name,
	options: z.array(name).optional(),
	detail: z.string().optional(),
	/** The index of the item's best priority label; no label is last. */
	priority: z.int().nonnegative(),
	/** The files the item declares it touches; none declared means it clashes with every item. */
	footprint: z.array(name).optional(),
	queuedAt: time,
	askedAt: time.optional(),
});

export type QueuedQuestion = z.infer<typeof QueuedQuestion>;

const settledFields = {
	item: name,
	/** The answer's number among the thread's answers and replies from people. */
	ordinal: z.int().positive(),
	text: name,
	disposition: z.enum(DISPOSITIONS),
	why: name,
	at: time,
};

/** What became of one answer on an item's thread, saved before its reply is posted: a marker may name an option, a first word or a model call always does, and the rest name none. */
export const SettledAnswer = z.discriminatedUnion("source", [
	z.object({ ...settledFields, source: z.literal(RESOLUTION_SOURCES.marker), option: name.optional() }),
	z.object({ ...settledFields, source: z.enum([RESOLUTION_SOURCES["first-word"], RESOLUTION_SOURCES.model]), option: name }),
	z.object({ ...settledFields, source: z.enum([RESOLUTION_SOURCES.free, RESOLUTION_SOURCES["none-of-these"], RESOLUTION_SOURCES.abstained]) }),
]);

export type SettledAnswer = z.infer<typeof SettledAnswer>;

/** The option a settled answer picked, when its source names one. */
export const optionOf = (answer: SettledAnswer): string | undefined => ("option" in answer ? answer.option : undefined);

const slotFields = {
	name,
	/** Which block of ports, among the slots, is this slot's. */
	index: z.int().nonnegative(),
	folder: name,
	/** The hash of the lockfiles the slot's dependencies were last installed from. */
	lockfiles: name.optional(),
	since: time,
};

/**
 * A prewarmed worktree of the owner's checkout that background runs work in. A free slot is made and not yet ready,
 * ready, returned and waiting to be refreshed, or out of the pool. A held slot is taken by an item's pass, or kept
 * because its branch holds a commit the remote lacks; it names the item.
 */
export const Slot = z.discriminatedUnion("status", [
	z.object({ ...slotFields, status: z.enum(["new", "free", "stale", "out"]) }),
	z.object({ ...slotFields, status: z.enum(["taken", "kept"]), item: name }),
]);

export type Slot = z.infer<typeof Slot>;

export type HeldSlot = Extract<Slot, { readonly item: string }>;

export type FreeSlot = Exclude<Slot, HeldSlot>;
