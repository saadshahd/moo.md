import { ItemId, type WorkSource } from "../adapter-api.ts";
import type { PullRequests } from "../adapters/pull-requests.ts";
import type { Git } from "../adapters/git.ts";
import type { DoneBy } from "../decide/merge.ts";
import { SPLIT } from "../decide/prose.ts";
import type { State } from "../state/open.ts";
import type { Landing, SavedPlan } from "../state/saved.ts";
import { dropEvidence } from "./evidence.ts";

/** Where a merged change's evidence ref is taken off: git in a repo with `remote`. */
export type EvidenceRemote = { readonly git: Git; readonly remote: string };

/** Where a merged change is: the base's commit once it is on it, and every commit that held it, absent where hum did not see them. */
export type OnBase = { readonly sha: string; readonly commits: readonly string[] | undefined };

/** A change a pull request merged: the commit the merge made on the base, after the run branch's own. */
export const mergedThrough = (landing: Landing | undefined, mergeCommit: string): OnBase => ({ sha: mergeCommit, commits: [...(landing?.commits ?? []), mergeCommit] });

/** How an item reached done: split by its plan run, else as landing found it cleared, else by the person who merged it while it waited. */
const doneByOf = (plan: SavedPlan | undefined, landing: Landing | undefined): DoneBy => (plan?.event === SPLIT ? "split" : (landing?.doneBy ?? "owner"));

/**
 * An item's change reached the base: its evidence ref is taken off the remote, the merge is kept for the measure with
 * how the item reached done and the plan, verdict and alignment grades behind it, the saved landing, plan, verdict and
 * pull request text go, and the merge is logged once per commit.
 */
export const recordMerged = async (state: State, { git, remote }: EvidenceRemote, { item, at, sha, commits }: OnBase & { readonly item: string; readonly at: number }): Promise<void> => {
	const landing = state.landings.get(item);
	const plan = state.plans.get(item);
	const evidence = state.pullRequests.get(item)?.evidence;

	if (evidence !== undefined && "url" in evidence) await dropEvidence(git, { remote, item });

	state.merges.put(item, {
		item,
		sha,
		at,
		paths: [...(landing?.change.paths ?? [])],
		baseChecked: false,
		commits: commits && [...commits],
		doneBy: doneByOf(plan, landing),
		plan,
		verdict: state.verdicts.get(item),
		alignment: landing?.alignment,
	});
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
		state.landings.list().map(async (landing) => {
			const pull = await pulls.find(landing.branch);

			if (pull?.state !== "MERGED") return;

			await workSource.finish(ItemId.parse(landing.item));
			await recordMerged(state, evidenceRemote, { item: landing.item, at, ...mergedThrough(landing, pull.mergeCommit) });
			state.items.remove(landing.item);
		}),
	);
};
