import { z } from "zod";
import type { Json } from "../../src/config/json.ts";

type Issue = { number: number; title: string; body: string; state: "OPEN" | "CLOSED"; labels: string[] };

type Comment = { body: string; createdAt: string };

type Pull = { id: string; head: string; base: string; title: string; state: "OPEN" | "MERGED" };

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
});

type Vars = z.infer<typeof Vars>;

const Posted = z.object({ message: z.string(), tree: z.string(), parents: z.array(z.string()) });

const REPOSITORY_ID = "R_fake";
const TOKENS = new Set(["token fake-token", "bearer fake-token"]);

const json = (status: number, value: Json, headers: Record<string, string> = {}) =>
	new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", ...headers } });

/** A GraphQL error GitHub would report in the reply's `errors`. */
class GraphqlFailure extends Error {
	constructor(readonly graphql: GraphqlError) {
		super(graphql.message);
	}
}

const failed = (type: string, message: string): never => {
	throw new GraphqlFailure({ type, message });
};

/**
 * An in-memory GitHub for one repo, behind a `fetch`: the GraphQL operations the adapter sends, by name, and the two
 * REST calls it keeps. It keeps what the adapter leans on: an issue list ETag that moves on any write, 304s that
 * spend no rate limit, refs that refuse a second create, and commits on a branch that refuse a stale head.
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
	#version = 1;
	#tick = 0;
	/** Each request: `GET /path?query` for REST, `graphql <operation>` for GraphQL. */
	readonly requests: string[] = [];
	/** The next `count` requests answer 502. */
	failures = 0;
	/** GraphQL operations whose next request answers 502. */
	readonly failsOnce = new Set<string>();

	// SAFETY: the fake answers the (url, init) calls Octokit makes; it is no full fetch (no preconnect).
	fetch = (async (input: string | URL | Request, init?: RequestInit) => {
		const url = new URL(String(input));
		const method = init?.method ?? "GET";
		const headers = new Headers(init?.headers);

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

	/** A person's comment on an issue. */
	say(number: number, text: string): void {
		this.#commentOn(number, text);
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

	comments(number: number): readonly Comment[] {
		return this.#comments.get(number) ?? [];
	}

	#issue(number: number | undefined): Issue {
		return this.#issues.find((found) => found.number === number) ?? failed("NOT_FOUND", `Could not resolve to an Issue with the number of ${number}.`);
	}

	#commentOn(number: number, text: string): void {
		this.#issue(number);
		this.#comments.set(number, [...this.comments(number), { body: text, createdAt: new Date(1_700_000_000_000 + ++this.#tick * 1000).toISOString() }]);
		this.#version++;
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
		Item: (v) => ({
			repository: {
				issue: { ...this.#issueNode(this.#issue(v.number)), comments: { nodes: [...this.comments(v.number ?? 0)], pageInfo: { hasNextPage: false, endCursor: null } } },
				ref: this.#commitTarget(v.claimRef),
			},
		}),
		Claim: (v) => ({ repository: { ref: this.#commitTarget(v.claimRef) } }),
		IssueState: (v) => ({ repository: { issue: this.#issueNode(this.#issue(v.number)) } }),
		Base: (v) => ({ repository: { id: REPOSITORY_ID, ref: this.#commitTarget(v.baseRef) } }),
		Label: (v) => ({ repository: { id: REPOSITORY_ID, label: this.#labels.has(v.label ?? "") ? { id: `L_${v.label}` } : null } }),
		Pulls: (v) => ({
			repository: {
				id: REPOSITORY_ID,
				issue: { title: this.#issue(v.number).title },
				pullRequests: { nodes: this.#pulls.filter((pull) => pull.head === v.head).map(({ id, state }) => ({ id, state })) },
			},
		}),
		AddComment: (v) => {
			this.#commentOn(Number(v.subject?.slice("I_".length)), v.body ?? "");

			return { addComment: { clientMutationId: null } };
		},
		CreateRef: (v) => {
			if (this.#refs.has(v.name ?? "")) failed("UNPROCESSABLE", `A ref named "${v.name}" already exists in the repository.`);

			this.#refs.set(v.name ?? "", v.oid ?? "");

			return { createRef: { clientMutationId: null } };
		},
		CommitOnBranch: (v) => {
			const ref = `refs/heads/${v.branch?.branchName}`;
			const head = this.#refs.get(ref);

			if (head !== v.expected) failed("STALE_DATA", `Expected branch to point to "${v.expected}" but it did not.  Pull and try again.`);

			const message = [v.message?.headline, v.message?.body].filter(Boolean).join("\n\n");

			this.#refs.set(ref, this.#commit({ message, tree: this.#commits.get(head ?? "")?.tree ?? "t0", parents: [head ?? ""] }));

			return { createCommitOnBranch: { clientMutationId: null } };
		},
		CreateLabel: (v) => {
			this.#labels.add(v.name ?? "");

			return { createLabel: { label: { id: `L_${v.name}` } } };
		},
		RecentIssues: () => ({ repository: { issues: { nodes: this.#issues.toReversed().slice(0, 20).map(({ number, title, body }) => ({ number, title, body })) } } }),
		CreateIssue: (v) => {
			const number = this.seed(v.title ?? "", { label: (v.labels?.[0] ?? "").slice("L_".length) });

			Object.assign(this.#issue(number), { body: v.body ?? "" });

			return { createIssue: { issue: { number } } };
		},
		CreatePull: (v) => {
			this.#pulls.push({ id: `PR_${this.#pulls.length + 1}`, head: v.head ?? "", base: v.base ?? "", title: v.title ?? "", state: "OPEN" });

			return { createPullRequest: { clientMutationId: null } };
		},
		MergePull: (v) => {
			const pull = this.#pulls.find((found) => found.id === v.pull) ?? failed("NOT_FOUND", `no pull ${v.pull}`);

			pull.state = "MERGED";

			return { mergePullRequest: { clientMutationId: null } };
		},
	} satisfies Readonly<Record<string, (v: Vars) => Json>>;

	#graphql(raw: string): Response {
		const { query, variables } = Request.parse(JSON.parse(raw));
		const operation = /^\s*(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? "";
		const run = Object.entries(this.#operations).find(([name]) => name === operation)?.[1] ?? failed("UNKNOWN", `the fake knows no operation "${operation}"`);

		this.requests.push(`graphql ${operation}`);

		if (this.failsOnce.delete(operation)) return new Response("bad gateway", { status: 502 });

		try {
			return json(200, { data: run(Vars.parse(variables)) });
		} catch (error) {
			if (!(error instanceof GraphqlFailure)) throw error;

			return json(200, { data: null, errors: [error.graphql] });
		}
	}

	#rest(method: string, url: URL, body: RequestInit["body"], headers: Headers): Response {
		const path = url.pathname.replace(`/repos/${this.repo}`, "");

		this.requests.push(`${method} ${url.pathname}${url.search}`);

		if (url.pathname === "/rate_limit") return json(200, { resources: { core: { remaining: this.remaining } } });

		if (method === "GET" && path === "/issues") {
			const etag = `W/"v${this.#version}"`;

			return headers.get("if-none-match") === etag ? new Response(null, { status: 304, headers: { etag } }) : json(200, this.#issues.slice(0, 1), { etag });
		}

		if (method === "POST" && path === "/git/commits") return json(201, { sha: this.#commit(Posted.parse(JSON.parse(String(body)))) });

		return json(404, { message: "Not Found" });
	}
}
