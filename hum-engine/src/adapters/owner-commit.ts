import type { MergeMethod } from "../config/schema.ts";
import type { PushOutcome } from "./git.ts";
import { methodFor, type Pull, type PullRequests } from "./pull-requests.ts";

export type OwnerCommit = {
	/** The commit to land, already built on the newest base. */
	readonly sha: string;
	readonly base: string;
	/** Names the commit's branch with its sha: what the commit is about, such as an item id. */
	readonly label: string;
	readonly title: string;
	readonly body: string;
	readonly branchPrefix: string;
	readonly mergeMethod: MergeMethod;
	/** Absent off GitHub, where a push is the only way to land. */
	readonly pulls?: PullRequests;
	/** Pushes refspecs to the remote. */
	readonly push: (refspecs: readonly string[]) => Promise<PushOutcome>;
};

export type CommitLanded =
	| { readonly via: "push" }
	| { readonly via: "pull-request"; readonly pull: Pull; readonly merged: boolean }
	/** Another writer moved the base first; the caller builds the commit again. */
	| { readonly via: "conflict" }
	/** The remote refused the push, in `said`, and the repo is not on GitHub, so no pull request can land it. */
	| { readonly via: "refused"; readonly said: string };

const throughPullRequest = async (commit: OwnerCommit, pulls: PullRequests): Promise<CommitLanded> => {
	const branch = `${commit.branchPrefix}${commit.label}-${commit.sha.slice(0, 12)}`;
	const rules = await pulls.rules(commit.base);

	const pushed = await commit.push([`${commit.sha}:refs/heads/${branch}`]);

	if (pushed.kind === "refused") return { via: "refused", said: pushed.said };

	const pull = (await pulls.find(branch)) ?? (await pulls.open({ head: branch, base: commit.base, title: commit.title, body: commit.body }));
	const armed = pull.state === "MERGED" ? "merged" : await pulls.autoMerge(pull, true, methodFor(commit.mergeMethod, rules.mergeMethods));

	return { via: "pull-request", pull, merged: armed === "merged" || pull.state === "MERGED" };
};

/**
 * Lands a commit the owner wrote. A base that requires a pull request gets one, on a branch of its own that
 * merges itself once the required checks pass; any other base takes a push. A push the remote refuses goes
 * through a pull request when the repo is on GitHub.
 */
export const landOwnerCommit = async (commit: OwnerCommit): Promise<CommitLanded> => {
	const { pulls } = commit;

	if (pulls && (await pulls.rules(commit.base)).requiresPullRequest) return throughPullRequest(commit, pulls);

	const outcome = await commit.push([`${commit.sha}:refs/heads/${commit.base}`]);

	if (outcome.kind !== "refused") return { via: outcome.kind === "pushed" ? "push" : "conflict" };

	if (!pulls) return { via: "refused", said: outcome.said };

	await pulls.rules(commit.base, true);

	return throughPullRequest(commit, pulls);
};
