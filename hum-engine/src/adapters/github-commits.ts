import { RequestError } from "@octokit/request-error";
import { z } from "zod";
import type { Env } from "../exec.ts";
import type { PushOutcome } from "./git.ts";
import { failureOf, type GitHubClient, ownerGitHub } from "./github-client.ts";

/** A file a commit adds or changes, its bytes in base64, as `createCommitOnBranch` takes it. */
export type FileAddition = { readonly path: string; readonly contents: string };

export type FileChanges = { readonly additions: readonly FileAddition[]; readonly deletions: readonly { readonly path: string }[] };

/** A commit GitHub made: its sha and its tree's. */
export type MadeCommit = { readonly oid: string; readonly tree: string };

/** What a write to a branch came to: done, beaten by another writer, or refused by the repo's rules in GitHub's words. */
export type BranchWrite<T> = { readonly kind: "done"; readonly value: T } | Exclude<PushOutcome, { kind: "pushed" }>;

/** Branches of a GitHub repo, written through GitHub's API. GitHub signs each commit it makes for the caller. */
export type GitHubCommits = {
	/** The branch's tip, or undefined when it does not exist. */
	readonly head: (branch: string) => Promise<string | undefined>;
	readonly createBranch: (branch: string, sha: string) => Promise<BranchWrite<void>>;
	/** One commit on the branch's tip, which must still be `expected`. */
	readonly commitOnBranch: (change: { readonly branch: string; readonly expected: string; readonly headline: string; readonly body: string; readonly files: FileChanges }) => Promise<BranchWrite<MadeCommit>>;
	/** Points the branch at `sha`; without `force`, only as a fast-forward. */
	readonly moveBranch: (branch: string, sha: string, force: boolean) => Promise<BranchWrite<void>>;
	readonly deleteBranch: (branch: string) => Promise<void>;
};

const COMMIT_ON_BRANCH = `mutation CommitSigned($branch: CommittableBranch!, $expected: GitObjectID!, $message: CommitMessage!, $files: FileChanges!) {
	createCommitOnBranch(input: { branch: $branch, expectedHeadOid: $expected, message: $message, fileChanges: $files }) { commit { oid tree { oid } } }
}`;

const Made = z.object({ createCommitOnBranch: z.object({ commit: z.object({ oid: z.string(), tree: z.object({ oid: z.string() }) }) }) });

const Ref = z.object({ object: z.object({ sha: z.string() }) });

const NOT_FOUND = 404;

/** REST's words when another writer moved or made the ref first. */
const RACED = /not a fast.forward|already exists/i;

/** A write's failure as an outcome: another writer first, or the repo's refusal; anything a retry may fix is thrown. */
const writeFailure = (cause: unknown): Exclude<PushOutcome, { kind: "pushed" }> => {
	if (cause instanceof RequestError && RACED.test(cause.message)) return { kind: "conflict" };

	const failure = failureOf(cause);

	if (failure.kind === "lost-race") return { kind: "conflict" };

	if (failure.kind === "permanent") return { kind: "refused", said: `GitHub refused: ${failure.message}` };

	throw cause;
};

const written = <T>(write: Promise<T>): Promise<BranchWrite<T>> => write.then((value) => ({ kind: "done" as const, value }), writeFailure);

/** The branches of `repo` (`owner/name`), on the owner's own login unless a client is given. */
export const gitHubCommits = (repo: string, options: { readonly timeoutMs: number } & ({ readonly client: () => Promise<GitHubClient> } | { readonly env: Env })): GitHubCommits => {
	const [owner = "", name = ""] = repo.split("/");
	const connect = "client" in options ? options.client : () => ownerGitHub(options.timeoutMs, options.env);
	const where = { owner, repo: name };

	return {
		head: async (branch) =>
			(await connect())
				.request("GET /repos/{owner}/{repo}/git/ref/{ref}", { ...where, ref: `heads/${branch}` })
				.then(
					(reply) => Ref.parse(reply.data).object.sha,
					(cause: unknown) => {
						if (cause instanceof RequestError && cause.status === NOT_FOUND) return undefined;

						throw cause;
					},
				),
		createBranch: async (branch, sha) => written((await connect()).request("POST /repos/{owner}/{repo}/git/refs", { ...where, ref: `refs/heads/${branch}`, sha }).then(() => undefined)),
		commitOnBranch: async ({ branch, expected, headline, body, files }) =>
			written(
				(await connect())
					.graphql(COMMIT_ON_BRANCH, { branch: { repositoryNameWithOwner: repo, branchName: branch }, expected, message: { headline, body }, files })
					.then((reply) => {
						const { commit } = Made.parse(reply).createCommitOnBranch;

						return { oid: commit.oid, tree: commit.tree.oid };
					}),
			),
		moveBranch: async (branch, sha, force) => written((await connect()).request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", { ...where, ref: `heads/${branch}`, sha, force }).then(() => undefined)),
		deleteBranch: async (branch) => void (await (await connect()).request("DELETE /repos/{owner}/{repo}/git/refs/{ref}", { ...where, ref: `heads/${branch}` })),
	};
};
