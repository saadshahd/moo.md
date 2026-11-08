import { z } from "zod";

const name = z.string().min(1);
const time = z.int().nonnegative();

/** Why an item sits out: it ended stuck, or its change waits for a review hum does not yet run. Until the owner acts, no run starts for it. */
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
});

export type Landing = z.infer<typeof Landing>;

/** A path rule the owner's answer made, committed on the base; the view lists it with an undo. */
export const Learned = z.strictObject({ glob: name, level: name, item: name, commit: name, at: time });

export type Learned = z.infer<typeof Learned>;
