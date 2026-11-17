import { labelChanges, type LabelRules, type PastChange } from "../decide/labels.ts";
import type { State } from "../state/open.ts";

/** Paths blocked by a break whose level blocks and whose follow-up has not merged. */
export const blockedPaths = (state: State): string[] =>
	state.breaks.list().flatMap(({ onBreak, followUp, paths }) => (onBreak === "block" && !state.merges.get(followUp) ? paths : []));

/** The commits whose merge broke the base: the fix limit counts them beside the breaks git labels. */
export const brokenCommits = (state: State): ReadonlySet<string> => new Set(state.breaks.list().map(({ sha }) => sha));

/** Saves the label git's rule gives each change in `changes` that broke, the base's own breaks counted; the measure reads a merge's label from its commits'. */
export const saveLabels = (state: State, changes: readonly PastChange[], rules: LabelRules): void => {
	for (const [sha, label] of labelChanges(changes, rules, brokenCommits(state))) {
		if (label !== "clean" && state.labels.get(sha)?.label !== label) state.labels.put(sha, { sha, label });
	}
};
