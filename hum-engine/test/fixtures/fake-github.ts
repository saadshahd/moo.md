import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { gitHubClient } from "../../src/adapters/github-client.ts";
import { type GitHubCommits, gitHubCommits } from "../../src/adapters/github-commits.ts";
import { gitHubPullRequests, type PullRequests } from "../../src/adapters/pull-requests.ts";
import type { Json } from "../../src/config/json.ts";
import { SHIPPED_COMMAND_TIMEOUT_MS } from "../../src/exec.ts";

type Issue = { number: number; title: string; body: string; state: "OPEN" | "CLOSED"; labels: string[] };

/** Who wrote a comment, as GitHub's GraphQL names them. */
export type Author = { readonly authorAssociation: string; readonly author: { readonly __typename: "User" | "Bot"; readonly login: string } | null };

/** The repo's owner, whose login the fake's tokens post on. */
export const OWNER: Author = { authorAssociation: "OWNER", author: { __typename: "User", login: "owner" } };

/** Someone with no tie to the repo, who may still comment on a public one. */
export const STRANGER: Author = { authorAssociation: "NONE", author: { __typename: "User", login: "stranger" } };

/** The bot a workflow's own token posts as. */
export const WORKFLOW_BOT: Author = { authorAssociation: "NONE", author: { __typename: "Bot", login: "github-actions" } };

type Comment = Author & { body: string; createdAt: string };

type Pull = { id: string; number: number; head: string; base: string; title: string; body: string; state: "OPEN" | "MERGED" | "CLOSED"; autoMerge: boolean; status: "CLEAN" | "BLOCKED" | "BEHIND" };

type Commit = { message: string; tree: string; parents: string[] };

type GraphqlError = { type: string; message: string };

const Request = z.object({ query: z.string(), variables: z.record(z.string(), z.unknown()).default({}) });

const Vars = z.looseObject({
	number: z.int().optional(),
	label: z.string().optional(),
	claimRefs: z.string().optional(),
	claimRef: z.string().optional(),
	baseRef: z.string().optional(),
	head: z.string().optional(),
	subject: z.string().optional(),
	body: z.string().optional(),
	name: z.string().optional(),
	oid: z.string().optional(),
	expected: z.string().optional(),
	branch: z.object({ branchName: z.string() }).optional(),
	message: z.object({ headline: z.string(), body: z.string().optional() }).optional(),
	title: z.string().optional(),
	labels: z.array(z.string()).optional(),
	base: z.string().optional(),
	pull: z.string().optional(),
	issue: z.string().optional(),
	files: z.object({ additions: z.array(z.object({ path: z.string(), contents: z.string() })).default([]), deletions: z.array(z.object({ path: z.string() })).default([]) }).optional(),
});

type Vars = z.infer<typeof Vars>;

const Posted = z.object({ message: z.string(), tree: z.string(), parents: z.array(z.string()) });

const RefPosted = z.object({ ref: z.string(), sha: z.string() });

const RefMoved = z.object({ sha: z.string(), force: z.boolean().default(false) });

/** git in the bare repo that backs the fake's real branches; a failure is the answer, never a throw. */
const gitAt = (repo: string, args: readonly string[], input?: Buffer | string) => {
	const ran = spawnSync("git", args, { cwd: repo, input, encoding: "utf8" });

	return { ok: ran.status === 0, out: ran.stdout.trim(), err: ran.stderr.trim() };
};

const REPOSITORY_ID = "R_fake";
const TOKENS = new Set(["token fake-token", "bearer fake-token"]);

/** A pull request as GitHub's GraphQL answers it. */
const pullNode = ({ id, number, state, status, autoMerge }: Pull): Json => ({
	id,
	number,
	url: `https://github.com/me/scratch/pull/${number}`,
	state,
	mergeStateStatus: status,
	autoMergeRequest: autoMerge ? { enabledAt: "2026-11-08T00:00:00Z" } : null,
});

const json = (status: number, value: Json, headers: Record<string, string> = {}) =>
	new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", ...headers } });

/** A GraphQL error GitHub would report in the reply's `errors`, which an operation answers in place of its data. */
class Refused {
	constructor(readonly graphql: GraphqlError) {}
}

const refused = (type: string, message: string): Refused => new Refused({ type, message });

/**
 * An in-memory GitHub for one repo, behind a `fetch`: the GraphQL operations the adapter sends, by name, and the two
 * REST calls it keeps. It keeps what the adapter leans on: an issue list ETag that moves on any write, 304s that
 * spend no rate limit, refs that refuse a second create, and commits on a branch that refuse a stale head. A new pull
 * request waits on its required checks (`BLOCKED`); `checksPass` makes it `CLEAN`, and merges it when auto-merge is on, as GitHub does.
 */
export class FakeGitHub {
	readonly repo = "me/scratch";
	remaining = 5000;
	#issues: Issue[] = [];
	#comments = new Map<number, Comment[]>();
	#labels = new Set<string>();
	#refs = new Map<string, string>([["refs/heads/main", "c0"]]);
	#commits = new Map<string, Commit>([["c0", { message: "base", tree: "t0", parents: [] }]]);
	#pulls: Pull[] = [];
	#pullComments: string[] = [];
	/** The base branch's rules ask for a pull request with passing checks. */
	requiresPullRequest = false;
	/** The base branch's rules ask for commits GitHub verified, which only the commits the fake makes are. */
	requiresSignatures = false;
	/** The bare repo whose branches the fake's ref and commit calls write, as GitHub's own do. */
	gitRemote: string | undefined;
	/** The commits the fake made through `createCommitOnBranch`: the ones GitHub signs. */
	readonly signed = new Set<string>();
	allowAutoMerge = true;
	#version = 1;
	#tick = 0;
	/** Each request: `GET /path?query` for REST, `graphql <operation>` for GraphQL. */
	readonly requests: string[] = [];
	/** Every call to `fetch`, a refused or failed one too. */
	fetched = 0;
	/** The next `count` requests answer 502. */
	failures = 0;
	/** GraphQL operations whose next request answers 502. */
	readonly failsOnce = new Set<string>();

	// SAFETY: the fake answers the (url, init) calls Octokit makes; it is no full fetch (no preconnect).
	fetch = (async (input: string | URL | Request, init?: RequestInit) => {
		const url = new URL(String(input));
		const method = init?.method ?? "GET";
		const headers = new Headers(init?.headers);

		this.fetched++;

		if (this.failures > 0) {
			this.failures--;

			return new Response("bad gateway", { status: 502 });
		}

		if (!TOKENS.has(headers.get("authorization")?.toLowerCase() ?? "")) return json(401, { message: "Bad credentials" });

		const answer = url.pathname === "/graphql" ? this.#graphql(String(init?.body)) : this.#rest(method, url, init?.body, headers);

		if (answer.status !== 304) this.remaining--;

		return answer;
	}) as typeof fetch;

	/** A person's issue: ready for hum. */
	seed(title: string, { label = "hum:ready" }: { label?: string } = {}): number {
		const number = this.#issues.length + 1;

		this.#labels.add(label);
		this.#issues.push({ number, title, body: `${title} body`, state: "OPEN", labels: [label] });
		this.#version++;

		return number;
	}

	/** A comment on an issue, the owner's unless `by` names another author. */
	say(number: number, text: string, by: Author = OWNER): void {
		const refusal = this.#commentOn(number, text, by);

		if (refusal) throw new Error(refusal.graphql.message);
	}

	/** A branch, as `git push` would make it. */
	branch(name: string): void {
		this.#refs.set(`refs/heads/${name}`, "c0");
	}

	branches(): string[] {
		return [...this.#refs.keys()].map((ref) => ref.slice("refs/heads/".length));
	}

	pulls(): readonly Pull[] {
		return this.#pulls;
	}

	/** Whether the issue is open or closed. */
	issueState(number: number): Issue["state"] | undefined {
		return this.#issues.find((found) => found.number === number)?.state;
	}

	comments(number: number): readonly Comment[] {
		return this.#comments.get(number) ?? [];
	}

	/** The body of each pull request comment, in order. */
	pullComments(): readonly string[] {
		return this.#pullComments;
	}

	/** The required checks pass: an armed pull request merges, any other may merge now. */
	checksPass(number: number): void {
		const pull = this.#pulls.find((found) => found.number === number);

		if (pull) Object.assign(pull, pull.autoMerge ? { state: "MERGED" } : { status: "CLEAN" });
	}

	client(): PullRequests {
		const client = gitHubClient({ token: "fake-token", fetch: this.fetch, spaced: false, timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS });

		return gitHubPullRequests(this.repo, { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS, client: async () => client });
	}

	/** The branches of `gitRemote` through the fake's API. */
	commits(): GitHubCommits {
		const client = gitHubClient({ token: "fake-token", fetch: this.fetch, spaced: false, timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS });

		return gitHubCommits(this.repo, { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS, client: async () => client });
	}

	#bare(): string {
		if (this.gitRemote === undefined) throw new Error("the fake has no git remote for its branches");

		return this.gitRemote;
	}

	/** createCommitOnBranch on the backing repo: the files applied to the branch's tip through a scratch index, the commit made as GitHub's. */
	#commitSigned(v: Vars): Json | Refused {
		const bare = this.#bare();
		const ref = `refs/heads/${v.branch?.branchName}`;
		const head = gitAt(bare, ["rev-parse", "--verify", "--quiet", ref]).out;

		if (head !== v.expected) return refused("STALE_DATA", `Expected branch to point to "${v.expected}" but it did not.  Pull and try again.`);

		const scratch = mkdtempSync(join(tmpdir(), "fake-index-"));
		const env = { ...process.env, GIT_INDEX_FILE: join(scratch, "index"), GIT_AUTHOR_NAME: "app[bot]", GIT_AUTHOR_EMAIL: "app@users.noreply.github.com", GIT_COMMITTER_NAME: "GitHub", GIT_COMMITTER_EMAIL: "noreply@github.com" };
		const indexed = (args: readonly string[], input?: Buffer) => spawnSync("git", args, { cwd: bare, env, input, encoding: "utf8" }).stdout.trim();

		try {
			indexed(["read-tree", head]);

			for (const { path, contents } of v.files?.additions ?? []) indexed(["update-index", "--add", "--cacheinfo", `100644,${indexed(["hash-object", "-w", "--stdin"], Buffer.from(contents, "base64"))},${path}`]);

			for (const { path } of v.files?.deletions ?? []) indexed(["update-index", "--force-remove", path]);

			const tree = indexed(["write-tree"]);
			const oid = indexed(["commit-tree", tree, "-p", head, "-m", [v.message?.headline, v.message?.body].filter(Boolean).join("\n\n")]);

			gitAt(bare, ["update-ref", ref, oid, head]);
			this.signed.add(oid);

			return { createCommitOnBranch: { commit: { oid, tree: { oid: tree } } } };
		} finally {
			rmSync(scratch, { recursive: true, force: true });
		}
	}

	/** The REST ref calls on the backing repo, as GitHub answers them: a second create and a move that is no fast-forward are refused, and so is a move of the base its rules keep for pull requests. */
	#refCall(method: string, ref: string, body: RequestInit["body"]): Response {
		const bare = this.#bare();
		const current = gitAt(bare, ["rev-parse", "--verify", "--quiet", ref]).out;

		if (method === "GET") return current ? json(200, { ref, object: { sha: current } }) : json(404, { message: "Not Found" });

		if (method === "DELETE") return gitAt(bare, ["update-ref", "-d", ref]).ok ? new Response(null, { status: 204 }) : json(422, { message: "Reference does not exist" });

		if (method === "POST") {
			const { ref: made, sha } = RefPosted.parse(JSON.parse(String(body)));

			return gitAt(bare, ["rev-parse", "--verify", "--quiet", made]).ok ? json(422, { message: "Reference already exists" }) : (gitAt(bare, ["update-ref", made, sha, ""]), json(201, { ref: made, object: { sha } }));
		}

		const { sha, force } = RefMoved.parse(JSON.parse(String(body)));

		if (ref === "refs/heads/main" && this.requiresPullRequest) return json(422, { message: "Repository rule violations found\n\nChanges must be made through a pull request." });

		if (!force && current && !gitAt(bare, ["merge-base", "--is-ancestor", current, sha]).ok) return json(422, { message: "Update is not a fast forward" });

		gitAt(bare, ["update-ref", ref, sha]);

		return json(200, { ref, object: { sha } });
	}

	#pull(id: string | undefined, change: Partial<Pull>, mutation: string): Json | Refused {
		const pull = this.#pulls.find((found) => found.id === id);

		if (!pull) return refused("NOT_FOUND", `no pull ${id}`);

		Object.assign(pull, change);

		return { [mutation]: { clientMutationId: null } };
	}

	#armRefusal(id: string | undefined): Refused | undefined {
		if (!this.allowAutoMerge) return refused("UNPROCESSABLE", "Pull request Auto merge is not allowed for this repository");

		return this.#pulls.find((found) => found.id === id)?.status === "CLEAN" ? refused("UNPROCESSABLE", "Pull request Pull request is in clean status") : undefined;
	}

	#issue(number: number | undefined): Issue | Refused {
		return this.#issues.find((found) => found.number === number) ?? refused("NOT_FOUND", `Could not resolve to an Issue with the number of ${number}.`);
	}

	#commentOn(number: number, text: string, by: Author = OWNER): Refused | undefined {
		const issue = this.#issue(number);

		if (issue instanceof Refused) return issue;

		this.#comments.set(number, [...this.comments(number), { ...by, body: text, createdAt: new Date(1_700_000_000_000 + ++this.#tick * 1000).toISOString() }]);
		this.#version++;

		return undefined;
	}

	#commitTarget(ref: string | undefined) {
		const oid = ref === undefined ? undefined : this.#refs.get(ref);
		const commit = oid === undefined ? undefined : this.#commits.get(oid);

		return oid && commit ? { target: { oid, message: commit.message, tree: { oid: commit.tree } } } : null;
	}

	#issueNode(issue: Issue) {
		return { id: `I_${issue.number}`, title: issue.title, body: issue.body, state: issue.state, labels: { nodes: issue.labels.map((name) => ({ name })) } };
	}

	#claims(prefix: string) {
		const refs = [...this.#refs.keys()].filter((ref) => ref.startsWith(prefix));

		return { totalCount: refs.length, nodes: refs.map((ref) => ({ name: ref.slice(prefix.length), target: { message: this.#commits.get(this.#refs.get(ref) ?? "")?.message ?? "" } })) };
	}

	#commit(commit: Commit): string {
		const sha = `c${this.#commits.size}`;

		this.#commits.set(sha, commit);

		return sha;
	}

	/** Each operation the adapter sends, by its name. */
	#operations = {
		ReadyItems: (v) => ({
			repository: {
				issues: { nodes: this.#issues.filter((issue) => issue.state === "OPEN" && issue.labels.includes(v.label ?? "")).map(({ number, title }) => ({ number, title })), pageInfo: { hasNextPage: false, endCursor: null } },
				refs: this.#claims(v.claimRefs ?? ""),
			},
		}),
		Item: (v) => {
			const issue = this.#issue(v.number);

			return issue instanceof Refused
				? issue
				: {
						repository: {
							issue: { ...this.#issueNode(issue), comments: { nodes: [...this.comments(issue.number)], pageInfo: { hasNextPage: false, endCursor: null } } },
							ref: this.#commitTarget(v.claimRef),
						},
					};
		},
		Claim: (v) => ({ repository: { ref: this.#commitTarget(v.claimRef) } }),
		IssueState: (v) => {
			const issue = this.#issue(v.number);

			return issue instanceof Refused ? issue : { repository: { issue: this.#issueNode(issue) } };
		},
		Base: (v) => ({ repository: { id: REPOSITORY_ID, ref: this.#commitTarget(v.baseRef) } }),
		Label: (v) => ({ repository: { id: REPOSITORY_ID, label: this.#labels.has(v.label ?? "") ? { id: `L_${v.label}` } : null } }),
		PullsFrom: (v) => ({ repository: { id: REPOSITORY_ID, pullRequests: { nodes: this.#pulls.filter((pull) => pull.head === v.head).toReversed().slice(0, 1).map(pullNode) } } }),
		AddComment: (v) => this.#commentOn(Number(v.subject?.slice("I_".length)), v.body ?? "") ?? { addComment: { clientMutationId: null } },
		CreateRef: (v) => {
			if (this.#refs.has(v.name ?? "")) return refused("UNPROCESSABLE", `A ref named "${v.name}" already exists in the repository.`);

			this.#refs.set(v.name ?? "", v.oid ?? "");

			return { createRef: { clientMutationId: null } };
		},
		CommitOnBranch: (v) => {
			const ref = `refs/heads/${v.branch?.branchName}`;
			const head = this.#refs.get(ref);

			if (head !== v.expected) return refused("STALE_DATA", `Expected branch to point to "${v.expected}" but it did not.  Pull and try again.`);

			const message = [v.message?.headline, v.message?.body].filter(Boolean).join("\n\n");

			this.#refs.set(ref, this.#commit({ message, tree: this.#commits.get(head ?? "")?.tree ?? "t0", parents: [head ?? ""] }));

			return { createCommitOnBranch: { clientMutationId: null } };
		},
		CloseIssue: (v) => {
			const issue = this.#issue(Number(v.issue?.slice("I_".length)));

			if (issue instanceof Refused) return issue;

			issue.state = "CLOSED";
			this.#version++;

			return { closeIssue: { clientMutationId: null } };
		},
		CommitSigned: (v) => this.#commitSigned(v),
		CreateLabel: (v) => {
			this.#labels.add(v.name ?? "");

			return { createLabel: { label: { id: `L_${v.name}` } } };
		},
		RecentIssues: () => ({ repository: { issues: { nodes: this.#issues.toReversed().slice(0, 20).map(({ number, title, body }) => ({ number, title, body })) } } }),
		CreateIssue: (v) => {
			const number = this.seed(v.title ?? "", { label: (v.labels?.[0] ?? "").slice("L_".length) });
			const issue = this.#issue(number);

			if (issue instanceof Refused) return issue;

			issue.body = v.body ?? "";

			return { createIssue: { issue: { number } } };
		},
		OpenPull: (v) => {
			const number = this.#pulls.length + 1;
			const pull: Pull = { id: `PR_${number}`, number, head: v.head ?? "", base: v.base ?? "", title: v.title ?? "", body: v.body ?? "", state: "OPEN", autoMerge: false, status: "BLOCKED" };

			this.#pulls.push(pull);

			return { createPullRequest: { pullRequest: pullNode(pull) } };
		},
		MergeNow: (v) => this.#pull(v.pull, { state: "MERGED" }, "mergePullRequest"),
		EnableAutoMerge: (v) => this.#armRefusal(v.pull) ?? this.#pull(v.pull, { autoMerge: true }, "enablePullRequestAutoMerge"),
		DisableAutoMerge: (v) => this.#pull(v.pull, { autoMerge: false }, "disablePullRequestAutoMerge"),
		UpdateBranch: (v) => this.#pull(v.pull, { status: "BLOCKED" }, "updatePullRequestBranch"),
		Comment: (v) => (this.#pullComments.push(v.body ?? ""), { addComment: { clientMutationId: null } }),
	} satisfies Readonly<Record<string, (v: Vars) => Json | Refused>>;

	#graphql(raw: string): Response {
		const { query, variables } = Request.parse(JSON.parse(raw));
		const operation = /^\s*(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? "";
		const run = Object.entries(this.#operations).find(([name]) => name === operation)?.[1];

		if (!run) throw new Error(`the fake knows no operation "${operation}"`);

		this.requests.push(`graphql ${operation}`);

		if (this.failsOnce.delete(operation)) return new Response("bad gateway", { status: 502 });

		const answer = run(Vars.parse(variables));

		return answer instanceof Refused ? json(200, { data: null, errors: [answer.graphql] }) : json(200, { data: answer });
	}

	#rest(method: string, url: URL, body: RequestInit["body"], headers: Headers): Response {
		const path = url.pathname.replace(`/repos/${this.repo}`, "");

		this.requests.push(`${method} ${url.pathname}${url.search}`);

		if (url.pathname === "/rate_limit") return json(200, { resources: { core: { remaining: this.remaining } } });

		if (method === "GET" && path.startsWith("/rules/branches/"))
			return json(200, [
				...(this.requiresPullRequest ? [{ type: "pull_request", parameters: { allowed_merge_methods: ["squash"] } }, { type: "required_status_checks" }] : [{ type: "deletion" }]),
				...(this.requiresSignatures ? [{ type: "required_signatures" }] : []),
			]);

		const refPath = /^\/git\/refs?(?:\/(.+))?$/.exec(decodeURIComponent(path));

		if (refPath && this.gitRemote !== undefined) return this.#refCall(method, `refs/${refPath[1] ?? ""}`, body);

		if (method === "GET" && path === "/issues") {
			const etag = `W/"v${this.#version}"`;

			return headers.get("if-none-match") === etag ? new Response(null, { status: 304, headers: { etag } }) : json(200, this.#issues.slice(0, 1), { etag });
		}

		if (method === "POST" && path === "/git/commits") return json(201, { sha: this.#commit(Posted.parse(JSON.parse(String(body)))) });

		return json(404, { message: "Not Found" });
	}
}
