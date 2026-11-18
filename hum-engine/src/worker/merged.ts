import { ItemId, type WorkSource } from "../adapter-api.ts";
import type { PullRequests } from "../adapters/pull-requests.ts";
import { type Git, isAncestor, isCommit } from "../adapters/git.ts";
import type { State } from "../state/open.ts";
import type { Landing } from "../state/saved.ts";
import { dropEvidence } from "./evidence.ts";

/** Where a merged change's evidence ref is taken off: git in a repo with `remote`. */
export type EvidenceRemote = { readonly git: Git; readonly remote: string };

/** Where a merged change is: the base's commit once it is on it, and every commit that held it, absent where hum did not see them. */
export type OnBase = { readonly sha: string; readonly commits: readonly string[] | undefined };

/** A change a pull request merged: the commit the merge made on the base, after the run branch's own. */
export const mergedThrough = (landing: Landing | undefined, mergeCommit: string): OnBase => ({ sha: mergeCommit, commits: [...(landing?.commits ?? []), mergeCommit] });

/**
 * An item's change reached the base: its evidence ref is taken off the remote, the merge is kept for the measure, the
 * saved landing, plan, verdict, pull request text, repro and split part go, and the merge is logged once per commit in the item's log,
 * which keeps how the item reached done and the picks behind it.
 */
export const recordMerged = async (state: State, { git, remote }: EvidenceRemote, { item, at, sha, commits }: OnBase & { readonly item: string; readonly at: number }): Promise<void> => {
	const landing = state.landings.get(item);
	const evidence = state.pullRequests.get(item)?.evidence;

	if (evidence !== undefined && "url" in evidence) await dropEvidence(git, { remote, item });

	state.merges.put(item, { item, sha, at, paths: [...(landing?.change.paths ?? [])], baseChecked: false, commits: commits && [...commits] });
	state.landings.remove(item);
	state.plans.remove(item);
	state.verdicts.remove(item);
	state.pullRequests.remove(item);
	state.repros.remove(item);
	state.parts.remove(item);
	state.events.add({ source: "work-source", sourceId: `merged:${sha}`, itemId: item, type: "merged", payload: {} });
};

/** Where an item ends once its change reached the base: the work source that lists it, and the remote its evidence ref is taken off. */
type Ending = { readonly workSource: Pick<WorkSource, "finish"> } & EvidenceRemote;

/** A landed item ends at the work source, so it is never listed again, its merge is recorded, so the measure counts it, and its saved state goes. */
const endLanded = async (state: State, { workSource, ...evidenceRemote }: Ending, { item, at, ...onBase }: OnBase & { readonly item: string; readonly at: number }): Promise<void> => {
	await workSource.finish(ItemId.parse(item));
	await recordMerged(state, evidenceRemote, { item, at, ...onBase });
	state.items.remove(item);
};

/** Where GitHub merged the landing's pull request, or undefined while it has not. */
const mergedPullOf = async (pulls: Pick<PullRequests, "find">, landing: Landing): Promise<OnBase | undefined> => {
	const pull = await pulls.find(landing.branch);

	return pull?.state === "MERGED" ? mergedThrough(landing, pull.mergeCommit) : undefined;
};

/** Where `base`, a ref of the base in `git`, holds the landing's last commit, as a push of its branch left it; undefined where it does not. */
const pushedOf = async (git: Git, base: string, landing: Landing): Promise<OnBase | undefined> => {
	const tip = landing.commits?.at(-1);

	if (tip === undefined || !(await isCommit(git, tip))) return undefined;

	return (await isAncestor(git, { ancestor: tip, descendant: base })) ? { sha: tip, commits: landing.commits } : undefined;
};

/**
 * A change that landed through a pull request is merged by GitHub after the worker has moved on. Each saved landing
 * whose pull request has merged ends its item.
 */
export const settleMergedPulls = async (state: State, { pulls, ...ending }: { readonly pulls: Pick<PullRequests, "find"> } & Ending, at: number): Promise<void> => {
	await Promise.all(
		state.landings.list().map(async (landing) => {
			const merged = await mergedPullOf(pulls, landing);

			if (merged) await endLanded(state, ending, { item: landing.item, at, ...merged });
		}),
	);
};

/**
 * Ends the item of a saved landing whose change already reached the base, by its pull request or by a push of its
 * branch, as one does whose pass died after the push and before the merge was recorded. It reads the remote and never
 * pushes, and it runs before anything prepares the landing again, which would read the landed change as empty. False
 * while the change waits to land.
 */
export const settleLanding = async (state: State, { pulls, base, ...ending }: { readonly pulls: Pick<PullRequests, "find"> | undefined; readonly base: string } & Ending, landing: Landing, at: number): Promise<boolean> => {
	const landed = (pulls && (await mergedPullOf(pulls, landing))) ?? (await pushedOf(ending.git, base, landing));

	if (landed === undefined) return false;

	await endLanded(state, ending, { item: landing.item, at, ...landed });

	return true;
};
