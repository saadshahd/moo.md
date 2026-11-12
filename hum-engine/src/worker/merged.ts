import type { PullRequests } from "../adapters/pull-requests.ts";
import type { State } from "../state/open.ts";

/**
 * An item's change reached the base: the merge is kept for the measure, the saved landing, plan and verdict go,
 * and the merge is logged once per commit.
 */
export const recordMerged = (state: State, { item, sha, at }: { readonly item: string; readonly sha: string; readonly at: number }): void => {
	const landing = state.landings.get(item);

	state.merges.put(item, { item, sha, at, paths: [...(landing?.change.paths ?? [])] });
	state.landings.remove(item);
	state.plans.remove(item);
	state.verdicts.remove(item);
	state.events.add({ source: "work-source", sourceId: `merged:${sha}`, itemId: item, type: "merged", payload: {} });
};

/**
 * A change that landed through a pull request is merged by GitHub after the worker has moved on, and the item is never
 * listed again. Each saved landing whose pull request has merged is recorded as merged, so the measure counts it.
 */
export const settleMergedPulls = async (state: State, pulls: Pick<PullRequests, "find">, at: number): Promise<void> => {
	await Promise.all(
		state.landings.list().map(async ({ item, branch, head }) => {
			if ((await pulls.find(branch))?.state !== "MERGED") return;

			recordMerged(state, { item, sha: head, at });
			state.items.remove(item);
		}),
	);
};
