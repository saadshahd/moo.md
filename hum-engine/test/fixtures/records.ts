import type { Finished, Runner } from "../../src/adapters/claude-p.ts";
import type { PastChange } from "../../src/decide/labels.ts";
import type { ReviewNote } from "../../src/loop/records.ts";

/** A commit on the base as history reads it: a one-line feature unless `change` says otherwise. */
export const pastChange = (change: Pick<PastChange, "sha"> & Partial<PastChange>): PastChange => ({ subject: "feat: x", body: "", files: ["a.ts"], size: 1, blamed: [], ...change });

/** A reviewer's comment on change `c1`, unless `note` says otherwise. */
export const reviewNote = (note: Partial<ReviewNote> = {}): ReviewNote => ({ source: "review-comment", sourceId: "1", change: "c1", hunk: "", text: "Use a lookup table.", at: 1, ...note });

/** A run that succeeded, spending one token, unless `run` says otherwise. */
export const finished = (run: Partial<Finished> = {}): Finished => ({
	kind: "finished",
	subtype: "success",
	isError: false,
	sessionId: "s",
	text: "",
	structured: undefined,
	tokens: 1,
	cacheReadTokens: 0,
	plugins: [],
	keySource: undefined,
	models: ["m"],
	...run,
});

/** A runner that is never limited and runs each request through `run`. */
export const runnerOf = (run: Runner["run"]): Runner => ({ run, limitedUntil: () => 0 });
