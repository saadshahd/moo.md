import type { Unread } from "../../types";
import type { ViewRead } from "./read.ts";

/** What every drawing of the view starts from. */
export type ViewInput = {
	readonly read: ViewRead;
	/** The clock, in milliseconds. */
	readonly now: number;
	readonly amberAfterSeconds: number;
	/** The width the surface gives the body, in cells. */
	readonly width: number;
	/** A read of the work source that keeps failing; the view reports it once it is past the amber limit. */
	readonly unread?: Unread;
};

/** The clock and the amber limit, which every age's text and colour come from. */
export type AgeInput = Pick<ViewInput, "now" | "amberAfterSeconds">;
