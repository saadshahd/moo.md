import { z } from "zod";
import { AlignmentAnswer } from "../decide/alignment.ts";
import { Cite, PlanFile } from "../decide/prose.ts";

const name = z.string().min(1);
const time = z.int().nonnegative();

/** Why an item sits out: it ended stuck, or its change waits for the owner's review. Until the owner acts, no run starts for it. */
export const Parked = z.strictObject({ item: name, why: z.enum(["stuck", "review"]), cause: name, since: time });

export type Parked = z.infer<typeof Parked>;

/** Tokens an item has spent over all its runs. The cap counts those after `base`, the total when the owner last answered. */
export const Spent = z.strictObject({ item: name, total: time, base: time });

export type Spent = z.infer<typeof Spent>;

/** Until when every run is held. Saved so a restart makes no call before it. */
export const Limit = z.strictObject({ until: time });

/** The ids a provider last listed as ready, so a restart still sees an empty list that contradicts them. */
export const ReadyList = z.strictObject({ ids: z.array(name) });

/** A finished change on its way to the base: what its diff showed, so a retry lands it again without a run. */
export const Landing = z.strictObject({
	item: name,
	branch: name,
	since: time,
	change: z.strictObject({ paths: z.array(name), size: z.int().nonnegative(), loosened: z.boolean(), pinChanged: z.boolean() }),
	/** The commit the change ends at, before hum marks the item done: what a review reads. */
	head: name,
	/** The owner approved this change in its review state, before it was saved. */
	ownerApproved: z.boolean(),
	/** The alignment call's grades, or why it abstained; made once per change. */
	alignment: z.union([z.strictObject({ graded: AlignmentAnswer }), z.strictObject({ abstained: name })]).optional(),
});

export type Landing = z.infer<typeof Landing>;

/** A path rule the owner's answer made, committed on the base; the view lists it with an undo. */
export const Learned = z.strictObject({ glob: name, level: name, item: name, commit: name, at: time });

export type Learned = z.infer<typeof Learned>;

/** The model ids that answered a model-judgment call; the measured record decides later whether they count. */
const models = z.array(name);

/** An item's kind, decided once: named by its source, picked by the model call, or the fallback when the call abstained. */
export const ItemKind = z.discriminatedUnion("from", [
	z.strictObject({ item: name, kind: name, from: z.literal("source") }),
	z.strictObject({ item: name, kind: name, from: z.literal("model") }),
	z.strictObject({ item: name, kind: name, from: z.literal("fallback"), why: name }),
]);

export type ItemKind = z.infer<typeof ItemKind>;

/** The plan a plan run made ready, saved with its hash so later runs read it unchanged. */
export const SavedPlan = z.strictObject({ item: name, plan: PlanFile, hash: name, models });

export type SavedPlan = z.infer<typeof SavedPlan>;

/** A fresh review run's verdict on the change that ends at `head`. */
export const Verdict = z.strictObject({ item: name, head: name, event: name, reason: z.string(), cites: z.array(Cite), models });

export type Verdict = z.infer<typeof Verdict>;
