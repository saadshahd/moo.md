import { GraphqlResponseError } from "@octokit/graphql";
import pMemoize from "p-memoize";
import { z } from "zod";
import type { Json } from "../config/json.ts";
import { MERGE_METHODS, type MergeMethod } from "../config/schema.ts";
import { type GitHubClient, MERGE_METHOD, ownerGitHub, raise } from "./github-client.ts";

/** What the target branch's rules ask of a change that lands on it. */
export type BranchRules = {
	readonly requiresPullRequest: boolean;
	/** The merge methods a pull request may use; undefined when no rule narrows them. */
	readonly mergeMethods: readonly MergeMethod[] | undefined;
};

export type Pull = {
	readonly id: string;
	readonly number: number;
	readonly url: string;
	readonly state: "OPEN" | "MERGED" | "CLOSED";
	readonly autoMerge: boolean;
	/** Its branch is behind the base, which a strict required check makes wait. */
	readonly behind: boolean;
};

/** Pull requests on the repo a run's changes land in. */
export type PullRequests = {
	/** The rules read once and kept; `fresh` reads them again, as after a push the remote refused. */
	readonly rules: (base: string, fresh?: boolean) => Promise<BranchRules>;
	/** The newest pull request from `head`, in any state. */
	readonly find: (head: string) => Promise<Pull | undefined>;
	readonly open: (change: {
		head: string;
		base: string;
		title: string;
		body: string;
	}) => Promise<Pull>;
	/** Turns auto-merge on or off. A pull request whose checks already passed takes no auto-merge, so it merges now. */
	readonly autoMerge: (
		pull: Pull,
		on: boolean,
		method: MergeMethod,
	) => Promise<"armed" | "merged" | "off">;
	/** Merges the pull request now. */
	readonly merge: (pull: Pull, method: MergeMethod) => Promise<void>;
	readonly update: (pull: Pull) => Promise<void>;
	/** One comment on the pull request. */
	readonly comment: (pull: Pull, body: string) => Promise<void>;
};

const Rule = z.looseObject({
	type: z.string(),
	parameters: z
		.looseObject({
			allowed_merge_methods: z.array(z.enum(MERGE_METHODS)).optional(),
		})
		.optional(),
});

const PULL_REQUEST_RULE = "pull_request";

const PullNode = z.object({
	id: z.string(),
	number: z.int(),
	url: z.string(),
	state: z.enum(["OPEN", "MERGED", "CLOSED"]),
	mergeStateStatus: z.string(),
	autoMergeRequest: z.object({ enabledAt: z.string().nullable() }).nullable(),
});

const PULL_FIELDS =
	"id number url state mergeStateStatus autoMergeRequest { enabledAt }";

const BEHIND = "BEHIND";

const PULLS = `query PullsFrom($owner: String!, $name: String!, $head: String!) {
	repository(owner: $owner, name: $name) { id pullRequests(headRefName: $head, first: 1, orderBy: { field: CREATED_AT, direction: DESC }) { nodes { ${PULL_FIELDS} } } }
}`;

const OPEN_PULL = `mutation OpenPull($repository: ID!, $base: String!, $head: String!, $title: String!, $body: String!) {
	createPullRequest(input: { repositoryId: $repository, baseRefName: $base, headRefName: $head, title: $title, body: $body }) { pullRequest { ${PULL_FIELDS} } }
}`;

const ENABLE_AUTO_MERGE = `mutation EnableAutoMerge($pull: ID!, $mergeMethod: PullRequestMergeMethod!) {
	enablePullRequestAutoMerge(input: { pullRequestId: $pull, mergeMethod: $mergeMethod }) { clientMutationId }
}`;

const DISABLE_AUTO_MERGE = `mutation DisableAutoMerge($pull: ID!) {
	disablePullRequestAutoMerge(input: { pullRequestId: $pull }) { clientMutationId }
}`;

const MERGE_NOW = `mutation MergeNow($pull: ID!, $mergeMethod: PullRequestMergeMethod!) {
	mergePullRequest(input: { pullRequestId: $pull, mergeMethod: $mergeMethod }) { clientMutationId }
}`;

const COMMENT = `mutation Comment($pull: ID!, $body: String!) {
	addComment(input: { subjectId: $pull, body: $body }) { clientMutationId }
}`;

const UPDATE_BRANCH = `mutation UpdateBranch($pull: ID!) {
	updatePullRequestBranch(input: { pullRequestId: $pull }) { clientMutationId }
}`;

const PullsReply = z.object({
	repository: z.object({
		id: z.string(),
		pullRequests: z.object({ nodes: z.array(PullNode) }),
	}),
});

const Opened = z.object({
	createPullRequest: z.object({ pullRequest: PullNode }),
});

const Acknowledged = z.looseObject({});

/** GitHub refuses auto-merge on a pull request that may merge now. */
const isMergeableNow = (cause: unknown): boolean =>
	cause instanceof GraphqlResponseError && /clean status/i.test(cause.message);

const pullOf = (node: z.infer<typeof PullNode>): Pull => ({
	id: node.id,
	number: node.number,
	url: node.url,
	state: node.state,
	autoMerge: node.autoMergeRequest !== null,
	behind: node.mergeStateStatus === BEHIND,
});

/** The method the owner set when the branch's rules allow it, else the first they allow. */
export const methodFor = (
	preferred: MergeMethod,
	allowed: readonly MergeMethod[] | undefined,
): MergeMethod =>
	allowed === undefined || allowed.includes(preferred)
		? preferred
		: (allowed[0] ?? preferred);

/** Pull requests and branch rules of a GitHub repo, on the owner's own login unless a client is given. `timeoutMs` bounds the `gh auth token` that reads that login. */
export const gitHubPullRequests = (
	repo: string,
	{ timeoutMs, client }: { readonly timeoutMs: number; readonly client?: () => Promise<GitHubClient> },
): PullRequests => {
	const [owner = "", name = ""] = repo.split("/");
	const connect = client ?? (() => ownerGitHub(timeoutMs));

	const rulesCache = new Map<string, BranchRules>();

	const graphql = async <T>(
		schema: z.ZodType<T>,
		document: string,
		variables: Readonly<Record<string, Json>>,
	): Promise<T> =>
		schema.parse(
			await (
				await connect()
			)
				.graphql(document, { owner, name, ...variables })
				.catch(raise),
		);

	const readRules = pMemoize(
		async (base: string): Promise<BranchRules> => {
			const reply = await (
				await connect()
			)
				.request("GET /repos/{owner}/{repo}/rules/branches/{branch}", {
					owner,
					repo: name,
					branch: base,
				})
				.catch(raise);

			const rules = z.array(Rule).parse(reply.data);
			const pullRule = rules.find((rule) => rule.type === PULL_REQUEST_RULE);

			return {
				requiresPullRequest: pullRule !== undefined,
				mergeMethods: pullRule?.parameters?.allowed_merge_methods,
			};
		},
		{ cache: rulesCache },
	);

	const merge = async (pull: Pull, method: MergeMethod): Promise<void> =>
		void (await graphql(Acknowledged, MERGE_NOW, { pull: pull.id, mergeMethod: MERGE_METHOD[method] }));

	const find = async (head: string): Promise<Pull | undefined> => {
		const node = (await graphql(PullsReply, PULLS, { head })).repository
			.pullRequests.nodes[0];

		return node && pullOf(node);
	};

	return {
		rules: (base, fresh = false) => {
			if (fresh) rulesCache.delete(base);

			return readRules(base);
		},
		find,
		open: async ({ head, base, title, body }) => {
			const repository = (await graphql(PullsReply, PULLS, { head })).repository
				.id;

			return pullOf(
				(
					await graphql(Opened, OPEN_PULL, {
						repository,
						base,
						head,
						title,
						body,
					})
				).createPullRequest.pullRequest,
			);
		},
		autoMerge: async (pull, on, method) => {
			if (!on) {
				if (pull.autoMerge)
					await graphql(Acknowledged, DISABLE_AUTO_MERGE, { pull: pull.id });

				return "off";
			}

			if (pull.autoMerge) return "armed";

			const mergeMethod = MERGE_METHOD[method];

			const armed = await (
				await connect()
			)
				.graphql(ENABLE_AUTO_MERGE, { pull: pull.id, mergeMethod })
				.then(
					() => true,
					(cause: unknown) => (isMergeableNow(cause) ? false : raise(cause)),
				);

			if (armed) return "armed";

			await merge(pull, method);

			return "merged";
		},
		merge,
		update: async (pull) =>
			void (await graphql(Acknowledged, UPDATE_BRANCH, { pull: pull.id })),
		comment: async (pull, body) =>
			void (await graphql(Acknowledged, COMMENT, { pull: pull.id, body })),
	};
};
