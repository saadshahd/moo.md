import ExpiryMap from "expiry-map";
import hostedGitInfo from "hosted-git-info";
import pMemoize from "p-memoize";
import { z } from "zod";
import { ADAPTER_API_VERSION, type AdapterContext, type Answers, type Claim, type Item, ItemId, PermanentError, type Integrations, type Questions, type Release, type Watch, type WorkSource } from "../adapter-api.ts";
import type { Json } from "../config/json.ts";
import type { MERGE_METHODS } from "../config/schema.ts";
import { TRUSTED_ASSOCIATIONS } from "../config/wake-job.ts";
import { HOUR_MS } from "../time.ts";
import { parseArgument } from "./argument.ts";
import { claimCommit, claimCommitMessage, claimer, claimOfCommit, isLive } from "./claim.ts";
import { failureOf, type GitHubClient, ownerGitHub, raise } from "./github-client.ts";
import { answerMarker, commentText, filedFollowUp, followUpBody, followUpNote, isFollowUpOf, type Marker, marked, parseComment, questionMarker, questionText } from "./marked.ts";
import { gitHubPullRequests } from "./pull-requests.ts";

const READY_LABEL_COLOR = "0e8a16";
const READY_LABEL_DESCRIPTION = "hum may take this item";

/** How long an issue's node id is kept after it was read. An id never changes; the limit only bounds what the worker holds. */
const ISSUE_ID_KEPT_MS = HOUR_MS;

type Variables = Readonly<Record<string, Json>>;

const IssueId = ItemId.refine((id) => /^[1-9]\d*$/.test(id), "a GitHub issue number is a whole number above 0");

const IssueNumber = IssueId.transform(Number);

const Repo = z.string().regex(/^[\w.-]+\/[\w.-]+$/, "a GitHub repo is owner/name");

const Commit = z.object({ oid: z.string(), message: z.string() });

const Labels = z.object({ nodes: z.array(z.object({ name: z.string() })) });

/** A comment with who wrote it; GitHub names no author once the account is deleted. */
const IssueComment = z.object({ body: z.string(), createdAt: z.string(), authorAssociation: z.string(), author: z.object({ __typename: z.string(), login: z.string() }).nullable() });

type IssueComment = z.infer<typeof IssueComment>;

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
			comments: z.object({ nodes: z.array(IssueComment) }),
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

const RecentIssuesReply = z.object({ repository: z.object({ issues: z.object({ nodes: z.array(z.object({ number: z.int().positive(), title: z.string(), body: z.string() })) }) }) });

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
			comments(first: 100, after: $cursor) { nodes { body createdAt authorAssociation author { __typename login } } pageInfo { hasNextPage endCursor } }
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

const ADD_COMMENT = `mutation AddComment($subject: ID!, $body: String!) {
	addComment(input: { subjectId: $subject, body: $body }) { clientMutationId }
}`;

const CREATE_REF = `mutation CreateRef($repository: ID!, $name: String!, $oid: GitObjectID!) {
	createRef(input: { repositoryId: $repository, name: $name, oid: $oid }) { clientMutationId }
}`;

const COMMIT_ON_BRANCH = `mutation CommitOnBranch($branch: CommittableBranch!, $expected: GitObjectID!, $message: CommitMessage!) {
	createCommitOnBranch(input: { branch: $branch, expectedHeadOid: $expected, message: $message, fileChanges: {} }) { clientMutationId }
}`;

const CLOSE_ISSUE = `mutation CloseIssue($issue: ID!) {
	closeIssue(input: { issueId: $issue, stateReason: COMPLETED }) { clientMutationId }
}`;

const CREATE_LABEL = `mutation CreateLabel($repository: ID!, $name: String!, $color: String!, $description: String!) {
	createLabel(input: { repositoryId: $repository, name: $name, color: $color, description: $description }) { label { id } }
}`;

/** The newest issues: a follow-up whose note was never written is among them, since the note is written right after it. */
const RECENT_ISSUES = `query RecentIssues($owner: String!, $name: String!) {
	repository(owner: $owner, name: $name) { issues(first: 20, orderBy: { field: CREATED_AT, direction: DESC }) { nodes { number title body } } }
}`;

const CREATE_ISSUE = `mutation CreateIssue($repository: ID!, $title: String!, $body: String!, $labels: [ID!]!) {
	createIssue(input: { repositoryId: $repository, title: $title, body: $body, labelIds: $labels }) { issue { number } }
}`;

/** The `owner/name` of a GitHub remote URL, or undefined for any other host. */
export const repoFromRemote = (url: string): string | undefined => {
	const remote = hostedGitInfo.fromUrl(url.trim());

	return remote?.type === "github" ? `${remote.user}/${remote.project}` : undefined;
};

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
	/** Logins whose comments are read whatever GitHub says of them, beside the people the repo trusts. */
	readonly ownerLogins: readonly string[];
	/** The client to use; by default one on the owner's own login. */
	readonly client?: GitHubClient;
	/** The owner's `commandTimeoutSeconds` in milliseconds: the limit of the `gh auth token` that reads the owner's login. */
	readonly timeoutMs: number;
};

type Whole = Integrations & {
	readonly workSource: WorkSource;
	readonly questions: Questions;
	readonly answers: Answers;
	readonly release: Release;
	/** Requests so far on its client that spent rate limit; a 304 spends none. The owner's client is shared, so other readers count too. */
	readonly spent: () => number;
};

type StandingClaim = { readonly claim: Claim; readonly sha: string };

const TRUSTED: ReadonlySet<string> = new Set(TRUSTED_ASSOCIATIONS);

/**
 * Whether hum reads a comment. Anyone may comment on a public repo, a reply after a question is an answer, and hum's
 * marker is only text, so who wrote a comment decides, never what it says. A person's is read when the repo trusts
 * them or the owner names them. A bot's is read only when it is one of hum's own: in CI hum posts as the workflow's
 * bot or the owner's App, and only a workflow or an App the owner installed posts as a bot at all.
 */
const isHeard = (owners: ReadonlySet<string>) => ({ body, author, authorAssociation }: IssueComment): boolean => {
	if (author === null) return false;

	return author.__typename === "Bot" ? parseComment(body, 0).author === "hum" : owners.has(author.login.toLowerCase()) || TRUSTED.has(authorAssociation);
};

/**
 * GitHub on the owner's own login: issues are items, and the comments hum reads are the thread. Each read is one GraphQL query,
 * each write one mutation. A claim is a branch: its first commit is made through REST, since no mutation makes a
 * bare commit, and created with `createRef`; a renewal or an expired take is `createCommitOnBranch` on the head it
 * read. `watch` is one REST request with `If-None-Match`, because GitHub answers 304 free of rate limit.
 */
export const githubAdapter = (options: GitHubOptions, { now, env }: AdapterContext): Whole => {
	const { base, claimPrefix, readyLabel, mergeMethod, timeoutMs } = options;
	const isHeardHere = isHeard(new Set(options.ownerLogins.map((login) => login.toLowerCase())));
	const repo = parseArgument(Repo, options.repo);
	const [owner = "", name = ""] = repo.split("/");
	const where = { owner, name };
	const claimRefs = `refs/heads/${claimPrefix}`;
	const issueIds = new ExpiryMap<number, string>(ISSUE_ID_KEPT_MS);
	let spent = 0;

	const client = pMemoize(async () => {
		const made = options.client ?? (await ownerGitHub(timeoutMs, env));

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

		return { ...repository, issue: { ...repository.issue, comments: { nodes: repository.issue.comments.nodes.filter(isHeardHere) } } };
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

	const claimFrom = (item: ItemId, target: { oid?: string; message?: string } | undefined): Claim | undefined => claimOfCommit(item, target?.message ?? "");

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

	const pulls = gitHubPullRequests(repo, { timeoutMs, client });

	return {
		apiVersion: ADAPTER_API_VERSION,
		spent: () => spent,
		workSource: {
			listReady: async () => {
				const { issues, refs } = (await paged(ReadyItems, READY_ITEMS, { label: readyLabel, claimRefs })).repository;

				if (refs.totalCount > refs.nodes.length) throw new PermanentError(`${repo} holds ${refs.totalCount} claim branches; hum reads ${refs.nodes.length}`);

				const claims = new Map(refs.nodes.flatMap((ref) => {
					const item = ItemId.safeParse(ref.name);

					return item.success ? [[ref.name, claimFrom(item.data, ref.target)] as const] : [];
				}));

				return issues.nodes.flatMap(({ number, title }) => (isLive(claims.get(String(number)), now()) ? [] : [{ id: ItemId.parse(String(number)), title }]));
			},
			read: async (id): Promise<Item> => {
				const { issue, ref } = await fetchItem(parseArgument(IssueNumber, id));

				return {
					id,
					title: issue.title,
					body: issue.body,
					ready: isReadyIssue(issue) && !isLive(claimFrom(id, ref?.target), now()),
					thread: issue.comments.nodes.map((found) => parseComment(found.body, Date.parse(found.createdAt))),
					labels: issue.labels.nodes.map((label) => label.name),
				};
			},
			claim: (id, holder, ttlMs) => take("claim", parseArgument(IssueId, id), holder, ttlMs),
			renew: (id, holder, ttlMs) => take("renew", parseArgument(IssueId, id), holder, ttlMs),
			comment: (id, text) => comment(id, commentText(text)),
			fileFollowUp: async (from, { title, body }) => {
				const { issue } = await fetchItem(parseArgument(IssueNumber, from));
				const filed = filedFollowUp(issue.comments.nodes.map((found) => found.body), title);

				if (filed !== undefined) return { id: filed, title };

				const created = async () => {
					const { repository, label } = await labelled();

					return (await mutate(CreatedIssue, CREATE_ISSUE, { repository, title, body: followUpBody(body, `#${from}`), labels: [label] })).createIssue.issue.number;
				};

				const recent = (await query(RecentIssuesReply, RECENT_ISSUES, {})).repository.issues.nodes;
				const id = ItemId.parse(String(recent.find(isFollowUpOf(`#${from}`, title))?.number ?? (await created())));
				const note = followUpNote(title, id);

				await commentMarked(from, note.marker, note.text);

				return { id, title };
			},
			finish: async (id) => {
				const issue = await issueState(parseArgument(IssueNumber, id));

				if (issue.state === "OPEN") await mutate(Acknowledged, CLOSE_ISSUE, { issue: issue.id });
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
				const found = await pulls.find(ref);

				if (found !== undefined && found.state !== "CLOSED") return;

				const { issue } = await fetchItem(parseArgument(IssueNumber, id));

				await pulls.open({ head: ref, base, title: issue.title, body: `Closes #${id}` });
			},
			release: async (id, ref) => {
				const pull = await pulls.find(ref);

				if (!pull || pull.state === "CLOSED") throw new PermanentError(`no pull request from ${ref} to release for item ${id}`);

				if (pull.state === "OPEN") await pulls.merge(pull, mergeMethod);
			},
		},
	};
};
