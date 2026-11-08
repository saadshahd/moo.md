import { Octokit } from "@octokit/core";
import { GraphqlResponseError } from "@octokit/graphql";
import { paginateGraphQL } from "@octokit/plugin-paginate-graphql";
import { type ThrottlingOptions, throttling } from "@octokit/plugin-throttling";
import { RequestError } from "@octokit/request-error";
import hostedGitInfo from "hosted-git-info";
import pMemoize from "p-memoize";
import { x } from "tinyexec";
import { z } from "zod";
import { type Adapter, type AdapterContext, type Answers, type Claim, type Item, ItemId, PermanentError, type Questions, type Release, type Watch, type WorkSource } from "../adapter-api.ts";
import type { Json } from "../config/json.ts";
import type { MERGE_METHODS } from "../config/schema.ts";
import { parseArgument } from "./argument.ts";
import { claimCommit, claimCommitMessage, claimer, claimOfCommit, isLive } from "./claim.ts";
import { answerMarker, commentText, filedFollowUp, followUpBody, followUpNote, type Marker, marked, parseComment, questionMarker, questionText } from "./marked.ts";

const RATE_LIMIT_RETRIES = 1;
const NOT_MODIFIED = 304;
const READY_LABEL_COLOR = "0e8a16";
const READY_LABEL_DESCRIPTION = "hum may take this item";

const HumOctokit = Octokit.plugin(throttling, paginateGraphQL);

export type GitHubClient = InstanceType<typeof HumOctokit>;

type Variables = Readonly<Record<string, Json>>;

/** The GraphQL name of each merge method. */
export const MERGE_METHOD = { merge: "MERGE", squash: "SQUASH", rebase: "REBASE" } as const satisfies Record<(typeof MERGE_METHODS)[number], string>;

const IssueNumber = ItemId.pipe(z.string().regex(/^[1-9]\d*$/, "a GitHub issue number is a whole number above 0")).transform(Number);

const Repo = z.string().regex(/^[\w.-]+\/[\w.-]+$/, "a GitHub repo is owner/name");

const Commit = z.object({ oid: z.string(), message: z.string() });

const Labels = z.object({ nodes: z.array(z.object({ name: z.string() })) });

const ReadyItems = z.object({
	repository: z.object({
		issues: z.object({ nodes: z.array(z.object({ number: z.int().positive(), title: z.string() })) }),
		refs: z.object({ totalCount: z.int(), nodes: z.array(z.object({ name: z.string(), target: Commit.partial() })) }),
	}),
});

const ItemReply = z.object({
	repository: z.object({
		issue: z.object({
			id: z.string(),
			title: z.string(),
			body: z.string(),
			state: z.enum(["OPEN", "CLOSED"]),
			labels: Labels,
			comments: z.object({ nodes: z.array(z.object({ body: z.string(), createdAt: z.string() })) }),
		}),
		ref: z.object({ target: Commit.partial() }).nullable(),
	}),
});

const ClaimReply = z.object({ repository: z.object({ ref: z.object({ target: Commit }).nullable() }) });

const IssueStateReply = z.object({ repository: z.object({ issue: z.object({ id: z.string(), state: z.enum(["OPEN", "CLOSED"]), labels: Labels }) }) });

const BaseReply = z.object({ repository: z.object({ id: z.string(), ref: z.object({ target: z.object({ oid: z.string(), tree: z.object({ oid: z.string() }) }) }) }) });

const LabelReply = z.object({ repository: z.object({ id: z.string(), label: z.object({ id: z.string() }).nullable() }) });

const CreatedLabel = z.object({ createLabel: z.object({ label: z.object({ id: z.string() }) }) });

const CreatedIssue = z.object({ createIssue: z.object({ issue: z.object({ number: z.int().positive() }) }) });

const PullsReply = z.object({
	repository: z.object({
		id: z.string(),
		issue: z.object({ title: z.string() }),
		pullRequests: z.object({ nodes: z.array(z.object({ id: z.string(), state: z.enum(["OPEN", "MERGED", "CLOSED"]) })) }),
	}),
});

const CreatedCommit = z.object({ sha: z.string() });

/** The reply of a write whose result hum does not read. */
const Acknowledged = z.looseObject({});

const READY_ITEMS = `query ReadyItems($owner: String!, $name: String!, $label: String!, $claimRefs: String!, $cursor: String) {
	repository(owner: $owner, name: $name) {
		issues(states: OPEN, labels: [$label], first: 100, after: $cursor, orderBy: { field: CREATED_AT, direction: ASC }) {
			nodes { number title }
			pageInfo { hasNextPage endCursor }
		}
		refs(refPrefix: $claimRefs, first: 100) { totalCount nodes { name target { ... on Commit { message } } } }
	}
}`;

const ITEM = `query Item($owner: String!, $name: String!, $number: Int!, $claimRef: String!, $cursor: String) {
	repository(owner: $owner, name: $name) {
		issue(number: $number) {
			id title body state
			labels(first: 100) { nodes { name } }
			comments(first: 100, after: $cursor) { nodes { body createdAt } pageInfo { hasNextPage endCursor } }
		}
		ref(qualifiedName: $claimRef) { target { ... on Commit { message } } }
	}
}`;

const CLAIM = `query Claim($owner: String!, $name: String!, $claimRef: String!) {
	repository(owner: $owner, name: $name) { ref(qualifiedName: $claimRef) { target { ... on Commit { oid message } } } }
}`;

const ISSUE_STATE = `query IssueState($owner: String!, $name: String!, $number: Int!) {
	repository(owner: $owner, name: $name) { issue(number: $number) { id state labels(first: 100) { nodes { name } } } }
}`;

const BASE = `query Base($owner: String!, $name: String!, $baseRef: String!) {
	repository(owner: $owner, name: $name) { id ref(qualifiedName: $baseRef) { target { ... on Commit { oid tree { oid } } } } }
}`;

const LABEL = `query Label($owner: String!, $name: String!, $label: String!) {
	repository(owner: $owner, name: $name) { id label(name: $label) { id } }
}`;

const PULLS = `query Pulls($owner: String!, $name: String!, $number: Int!, $head: String!) {
	repository(owner: $owner, name: $name) {
		id
		issue(number: $number) { title }
		pullRequests(headRefName: $head, states: [OPEN, MERGED], first: 1) { nodes { id state } }
	}
}`;

const ADD_COMMENT = `mutation AddComment($subject: ID!, $body: String!) {
	addComment(input: { subjectId: $subject, body: $body }) { clientMutationId }
}`;

const CREATE_REF = `mutation CreateRef($repository: ID!, $name: String!, $oid: GitObjectID!) {
	createRef(input: { repositoryId: $repository, name: $name, oid: $oid }) { clientMutationId }
}`;

const COMMIT_ON_BRANCH = `mutation CommitOnBranch($branch: CommittableBranch!, $expected: GitObjectID!, $message: CommitMessage!) {
	createCommitOnBranch(input: { branch: $branch, expectedHeadOid: $expected, message: $message, fileChanges: {} }) { clientMutationId }
}`;

const CREATE_LABEL = `mutation CreateLabel($repository: ID!, $name: String!, $color: String!, $description: String!) {
	createLabel(input: { repositoryId: $repository, name: $name, color: $color, description: $description }) { label { id } }
}`;

const CREATE_ISSUE = `mutation CreateIssue($repository: ID!, $title: String!, $body: String!, $labels: [ID!]!) {
	createIssue(input: { repositoryId: $repository, title: $title, body: $body, labelIds: $labels }) { issue { number } }
}`;

const CREATE_PULL = `mutation CreatePull($repository: ID!, $base: String!, $head: String!, $title: String!, $body: String!) {
	createPullRequest(input: { repositoryId: $repository, baseRefName: $base, headRefName: $head, title: $title, body: $body }) { clientMutationId }
}`;

const MERGE_PULL = `mutation MergePull($pull: ID!, $mergeMethod: PullRequestMergeMethod!) {
	mergePullRequest(input: { pullRequestId: $pull, mergeMethod: $mergeMethod }) { clientMutationId }
}`;

/** What a failed request means to hum. */
type Failure =
	/** GitHub answered 304 to a conditional request: nothing changed, and no rate limit was spent. */
	| { readonly kind: "not-modified" }
	/** Another writer took the ref first: it already exists, or it moved since it was read. */
	| { readonly kind: "lost-race" }
	/** No retry fixes it: a 4xx other than a rate limit, or a GraphQL error about the request itself. */
	| { readonly kind: "permanent"; readonly message: string }
	| { readonly kind: "transient" };

/** GraphQL errors about the request itself; any other, such as a timeout GitHub reports, may pass on a retry. */
const PERMANENT_GRAPHQL_ERRORS: ReadonlySet<string> = new Set(["NOT_FOUND", "FORBIDDEN", "UNPROCESSABLE"]);

const isRateLimited = (error: RequestError): boolean => error.status === 429 || (error.status === 403 && error.response?.headers["x-ratelimit-remaining"] === "0");

const failureOf = (cause: unknown): Failure => {
	if (cause instanceof RequestError) {
		if (cause.status === NOT_MODIFIED) return { kind: "not-modified" };

		return cause.status >= 400 && cause.status < 500 && !isRateLimited(cause) ? { kind: "permanent", message: cause.message } : { kind: "transient" };
	}

	const found = cause instanceof GraphqlResponseError ? cause.errors?.[0] : undefined;

	if (found?.type === "STALE_DATA" || (found?.type === "UNPROCESSABLE" && /already exists/i.test(found.message))) return { kind: "lost-race" };

	return found && PERMANENT_GRAPHQL_ERRORS.has(found.type ?? "") ? { kind: "permanent", message: found.message } : { kind: "transient" };
};

/** Throws `cause`, marked permanent when no retry can fix it. */
export const raise = (cause: unknown): never => {
	const failure = failureOf(cause);

	throw failure.kind === "permanent" ? new PermanentError(failure.message, { cause }) : cause;
};

/** The `owner/name` of a GitHub remote URL, or undefined for any other host. */
export const repoFromRemote = (url: string): string | undefined => {
	const remote = hostedGitInfo.fromUrl(url.trim());

	return remote?.type === "github" ? `${remote.user}/${remote.project}` : undefined;
};

/** The owner's own login: `GH_TOKEN` or `GITHUB_TOKEN`, else the token `gh` holds. */
export const ownerToken = async (): Promise<string> => {
	const fromEnv = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

	if (fromEnv) return fromEnv;

	const gh = await x("gh", ["auth", "token"], { stdin: "" });
	const token = gh.stdout.trim();

	if (gh.exitCode !== 0 || token === "") throw new PermanentError("no GitHub login: run `gh auth login`, or set GH_TOKEN");

	return token;
};

const retryOnce: NonNullable<ThrottlingOptions["onRateLimit"]> = (_retryAfter, _options, _octokit, retryCount) => retryCount < RATE_LIMIT_RETRIES;

export type GitHubClientOptions = {
	readonly token: string;
	readonly baseUrl?: string;
	/** Replaces `fetch`, for a GitHub that is not github.com. */
	readonly fetch?: typeof fetch;
	/** Whether writes are spaced as GitHub asks; only a GitHub with no secondary rate limit may go without. */
	readonly spaced?: boolean;
};

/** A GitHub client that waits out rate limits and spaces its writes as GitHub asks. */
export const gitHubClient = ({ token, baseUrl, fetch, spaced = true }: GitHubClientOptions): GitHubClient =>
	new HumOctokit({
		auth: token,
		userAgent: "hum",
		baseUrl,
		request: { fetch },
		throttle: { enabled: spaced, onRateLimit: retryOnce, onSecondaryRateLimit: retryOnce },
	});

export type GitHubOptions = {
	/** `owner/name`. */
	readonly repo: string;
	/** Where claims branch from and pull requests land. */
	readonly base: string;
	/** A claim is the first push of the branch this prefix and the issue number make. */
	readonly claimPrefix: string;
	/** Open issues with this label are the ready items. */
	readonly readyLabel: string;
	readonly mergeMethod: (typeof MERGE_METHODS)[number];
	/** The client to use; by default one on the owner's own login. */
	readonly client?: GitHubClient;
};

type Whole = Adapter & {
	readonly workSource: WorkSource;
	readonly questions: Questions;
	readonly answers: Answers;
	readonly release: Release;
	/** Requests so far that spent rate limit; a 304 spends none. */
	readonly spent: () => number;
};

type StandingClaim = { readonly claim: Claim; readonly sha: string };

/**
 * GitHub on the owner's own login: issues are items, comments are the thread. Each read is one GraphQL query,
 * each write one mutation. A claim is a branch: its first commit is made through REST, since no mutation makes a
 * bare commit, and created with `createRef`; a renewal or an expired take is `createCommitOnBranch` on the head it
 * read. `watch` is one REST request with `If-None-Match`, because GitHub answers 304 free of rate limit.
 */
export const githubAdapter = (options: GitHubOptions, { now }: AdapterContext): Whole => {
	const { base, claimPrefix, readyLabel, mergeMethod } = options;
	const repo = parseArgument(Repo, options.repo);
	const [owner = "", name = ""] = repo.split("/");
	const where = { owner, name };
	const claimRefs = `refs/heads/${claimPrefix}`;
	const issueIds = new Map<number, string>();
	let spent = 0;

	const client = pMemoize(async () => {
		const made = options.client ?? gitHubClient({ token: await ownerToken() });

		made.hook.after("request", () => void spent++);
		made.hook.error("request", (error) => {
			if (failureOf(error).kind !== "not-modified") spent++;

			throw error;
		});

		return made;
	});

	const query = async <T>(schema: z.ZodType<T>, document: string, variables: Variables): Promise<T> =>
		schema.parse(await (await client()).graphql(document, { ...where, ...variables }).catch(raise));

	const paged = async <T>(schema: z.ZodType<T>, document: string, variables: Variables): Promise<T> =>
		schema.parse(await (await client()).graphql.paginate(document, { ...where, ...variables }).catch(raise));

	const mutate = async <T>(schema: z.ZodType<T>, document: string, variables: Variables): Promise<T> => schema.parse(await (await client()).graphql(document, variables).catch(raise));

	/** A write that may lose a race: false when another writer took the ref first. */
	const mutateUnlessRaced = async (document: string, variables: Variables): Promise<boolean> =>
		(await client())
			.graphql(document, variables)
			.then(() => true)
			.catch((cause: unknown) => (failureOf(cause).kind === "lost-race" ? false : raise(cause)));

	const isReadyIssue = ({ state, labels }: { state: string; labels: z.infer<typeof Labels> }): boolean => state === "OPEN" && labels.nodes.some((label) => label.name === readyLabel);

	const issueState = async (number: number) => {
		const { issue } = (await query(IssueStateReply, ISSUE_STATE, { number })).repository;

		issueIds.set(number, issue.id);

		return issue;
	};

	const issueId = async (number: number): Promise<string> => issueIds.get(number) ?? (await issueState(number)).id;

	const fetchItem = async (number: number) => {
		const { repository } = await paged(ItemReply, ITEM, { number, claimRef: `${claimRefs}${number}` });

		issueIds.set(number, repository.issue.id);

		return repository;
	};

	const comment = async (id: string, body: string): Promise<void> => {
		await mutate(Acknowledged, ADD_COMMENT, { subject: await issueId(parseArgument(IssueNumber, id)), body });
	};

	const commentMarked = (id: string, marker: Marker, text: string) => comment(id, marked(marker, text));

	/** The repository's node id and the ready label's, made on first use. */
	const labelled = pMemoize(async () => {
		const { repository } = await query(LabelReply, LABEL, { label: readyLabel });
		const made = async () => (await mutate(CreatedLabel, CREATE_LABEL, { repository: repository.id, name: readyLabel, color: READY_LABEL_COLOR, description: READY_LABEL_DESCRIPTION })).createLabel.label.id;


		return { repository: repository.id, label: repository.label?.id ?? (await made()) };
	});

	const claimFrom = (item: string, target: { oid?: string; message?: string } | undefined): Claim | undefined => claimOfCommit(item, target?.message ?? "");

	const firstClaim = async (claim: Claim): Promise<boolean> => {
		const { repository } = await query(BaseReply, BASE, { baseRef: `refs/heads/${base}` });
		const { target } = repository.ref;

		const made = await (await client())
			.request("POST /repos/{owner}/{repo}/git/commits", { owner, repo: name, message: claimCommitMessage(claim), tree: target.tree.oid, parents: [target.oid] })
			.catch(raise);

		return mutateUnlessRaced(CREATE_REF, { repository: repository.id, name: `${claimRefs}${claim.item}`, oid: CreatedCommit.parse(made.data).sha });
	};

	const take = claimer<StandingClaim>(
		{
			standing: async (id) => {
				const target = (await query(ClaimReply, CLAIM, { claimRef: `${claimRefs}${id}` })).repository.ref?.target;
				const claim = claimFrom(id, target);

				return target && claim && { claim, sha: target.oid };
			},
			isReady: async (id) => isReadyIssue(await issueState(parseArgument(IssueNumber, id))),
			write: (claim, over) =>
				over
					? mutateUnlessRaced(COMMIT_ON_BRANCH, { branch: { repositoryNameWithOwner: repo, branchName: `${claimPrefix}${claim.item}` }, expected: over.sha, message: claimCommit(claim) })
					: firstClaim(claim),
		},
		now,
	);

	const pullFor = async (id: string, head: string) => {
		const { repository } = await query(PullsReply, PULLS, { number: parseArgument(IssueNumber, id), head });

		return { ...repository, pull: repository.pullRequests.nodes[0] };
	};

	return {
		apiVersion: 1,
		spent: () => spent,
		workSource: {
			listReady: async () => {
				const { issues, refs } = (await paged(ReadyItems, READY_ITEMS, { label: readyLabel, claimRefs })).repository;

				if (refs.totalCount > refs.nodes.length) throw new PermanentError(`${repo} holds ${refs.totalCount} claim branches; hum reads ${refs.nodes.length}`);

				const claims = new Map(refs.nodes.map((ref) => [ref.name, claimFrom(ref.name, ref.target)]));

				return issues.nodes.flatMap(({ number, title }) => (isLive(claims.get(String(number)), now()) ? [] : [{ id: String(number), title }]));
			},
			read: async (id): Promise<Item> => {
				const { issue, ref } = await fetchItem(parseArgument(IssueNumber, id));

				return {
					id,
					title: issue.title,
					body: issue.body,
					ready: isReadyIssue(issue) && !isLive(claimFrom(id, ref?.target), now()),
					thread: issue.comments.nodes.map((found) => parseComment(found.body, Date.parse(found.createdAt))),
				};
			},
			claim: (id, holder, ttlMs) => take("claim", String(parseArgument(IssueNumber, id)), holder, ttlMs),
			renew: (id, holder, ttlMs) => take("renew", String(parseArgument(IssueNumber, id)), holder, ttlMs),
			comment: (id, text) => comment(id, commentText(text)),
			fileFollowUp: async (from, { title, body }) => {
				const { issue } = await fetchItem(parseArgument(IssueNumber, from));
				const filed = filedFollowUp(issue.comments.nodes.map((found) => found.body), title);

				if (filed !== undefined) return { id: filed, title };

				const { repository, label } = await labelled();
				const made = await mutate(CreatedIssue, CREATE_ISSUE, { repository, title, body: followUpBody(body, `#${from}`), labels: [label] });
				const note = followUpNote(title, String(made.createIssue.issue.number));

				await commentMarked(from, note.marker, note.text);

				return { id: String(made.createIssue.issue.number), title };
			},
		},
		questions: {
			ask: (id, question) => commentMarked(id, questionMarker(question.options), questionText(question)),
			decide: (id, text) => commentMarked(id, { kind: "decision" }, text),
		},
		answers: {
			answer: (id, { text, option }) => commentMarked(id, answerMarker(option), text),
			/** Any comment or issue change moves the newest issue's `updated_at`, so the list's ETag moves. */
			watch: async (since?: string): Promise<Watch> => {
				const token = await (await client())
					.request("GET /repos/{owner}/{repo}/issues", { owner, repo: name, state: "all", sort: "updated", direction: "desc", per_page: 1, headers: since === undefined ? {} : { "if-none-match": since } })
					.then(
						(reply) => reply.headers.etag,
						(cause: unknown) => (failureOf(cause).kind === "not-modified" ? since : raise(cause)),
					);

				if (!token) throw new PermanentError("GitHub sent no ETag on the issue list, so watch has nothing to compare");

				return { token, changed: token !== since };
			},
		},
		release: {
			publish: async (id, ref) => {
				const { pull, issue, id: repository } = await pullFor(id, ref);

				if (pull) return;

				await mutate(Acknowledged, CREATE_PULL, { repository, base, head: ref, title: issue.title, body: `Closes #${id}` });
			},
			release: async (id, ref) => {
				const { pull } = await pullFor(id, ref);

				if (!pull) throw new PermanentError(`no pull request from ${ref} to release for item ${id}`);

				if (pull.state === "OPEN") await mutate(Acknowledged, MERGE_PULL, { pull: pull.id, mergeMethod: MERGE_METHOD[mergeMethod] });
			},
		},
	};
};
