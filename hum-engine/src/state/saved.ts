import { z } from "zod";

const name = z.string().min(1);
const time = z.int().nonnegative();

/** Why an item sits out: it ended stuck, or its change waits for a review hum does not yet run. Until the owner acts, no run starts for it. */
export const Parked = z.strictObject({ item: name, why: z.enum(["stuck", "review"]), cause: name, since: time });

export type Parked = z.infer<typeof Parked>;

/** E1: tokens an item has spent over all its runs. The cap counts those after `base`, the total when the owner last answered. */
export const Spent = z.strictObject({ item: name, total: time, base: time });

export type Spent = z.infer<typeof Spent>;

/** R4: until when every run is held. Saved so a restart makes no call before it. */
export const Limit = z.strictObject({ until: time });

/** R3: the ids a provider last listed as ready, so a restart still sees an empty list that contradicts them. */
export const ReadyList = z.strictObject({ ids: z.array(name) });
