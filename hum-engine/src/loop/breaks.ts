import type { State } from "../state/open.ts";

/** Paths blocked by a break whose level blocks and whose follow-up has not merged. */
export const blockedPaths = (state: State): string[] =>
	state.breaks.list().flatMap(({ onBreak, followUp, paths }) => (onBreak === "block" && !state.merges.get(followUp) ? paths : []));

/** The commits whose merge broke the base: the fix limit counts them beside the breaks git labels. */
export const brokenCommits = (state: State): ReadonlySet<string> => new Set(state.breaks.list().map(({ sha }) => sha));
