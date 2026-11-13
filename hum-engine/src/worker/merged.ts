import { ItemId, type WorkSource } from "../adapter-api.ts";
import type { PullRequests } from "../adapters/pull-requests.ts";
import type { Git } from "../adapters/git.ts";
import type { State } from "../state/open.ts";
import { dropEvidence } from "./evidence.ts";

/** Where a merged change's evidence ref is taken off: git in a repo with `remote`. */
export type EvidenceRemote = { readonly git: Git; readonly remote: string };

/**
 * An item's change reached the base: its evidence ref is taken off the remote, the merge is kept for the measure, the
 * saved landing, plan, verdict and pull request text go, and the merge is logged once per commit.
 */
export const recordMerged = async (state: State, { git, remote }: EvidenceRemote, { item, sha, at }: { readonly item: string; readonly sha: string; readonly at: number }): Promise<void> => {
	const landing = state.landings.get(item);
	const evidence = state.pullRequests.get(item)?.evidence;

	if (evidence !== undefined && "url" in evidence) await dropEvidence(git, { remote, item });

	state.merges.put(item, { item, sha, at, paths: [...(landing?.change.paths ?? [])], baseChecked: false });
	state.landings.remove(item);
	state.plans.remove(item);
	state.verdicts.remove(item);
	state.pullRequests.remove(item);
	state.events.add({ source: "work-source", sourceId: `merged:${sha}`, itemId: item, type: "merged", payload: {} });
};

/**
 * A change that landed through a pull request is merged by GitHub after the worker has moved on. Each saved landing
 * whose pull request has merged ends its item at the work source, so it is never listed again, and is recorded as
 * merged, so the measure counts it.
 */
export const settleMergedPulls = async (state: State, { pulls, workSource, ...evidenceRemote }: { readonly pulls: Pick<PullRequests, "find">; readonly workSource: Pick<WorkSource, "finish"> } & EvidenceRemote, at: number): Promise<void> => {
	await Promise.all(
		state.landings.list().map(async ({ item, branch, head }) => {
			if ((await pulls.find(branch))?.state !== "MERGED") return;

			await workSource.finish(ItemId.parse(item));
			await recordMerged(state, evidenceRemote, { item, sha: head, at });
			state.items.remove(item);
		}),
	);
};
