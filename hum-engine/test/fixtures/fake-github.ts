import { createHash } from "node:crypto";
import { z } from "zod";
import type { Json } from "../../src/config/json.ts";

/** What a request body may carry; the fake reads only these. */
const Body = z.looseObject({
	name: z.string().optional(),
	title: z.string().optional(),
	body: z.string().optional(),
	labels: z.array(z.string()).optional(),
	message: z.string().optional(),
	tree: z.string().optional(),
	parents: z.array(z.string()).optional(),
	ref: z.string().optional(),
	sha: z.string().optional(),
	head: z.string().optional(),
	base: z.string().optional(),
});

type Body = z.infer<typeof Body>;

type Issue = { number: number; title: string; body: string; state: "open" | "closed"; labels: { name: string }[]; updated: number };

type Comment = { id: number; body: string; created_at: string };

type Pull = { number: number; head: string; base: string; title: string; merged_at: string | null; state: "open" | "closed" };

/**
 * An in-memory GitHub REST API for one repo, behind a `fetch`. It keeps the behaviour the adapter leans on:
 * ETags that move on any issue or comment write, 304s that spend no rate limit, and refs that refuse a second
 * create and a non-fast-forward update.
 */
export class FakeGitHub {
	readonly repo = "me/scratch";
	remaining = 5000;
	#issues: Issue[] = [];
	#comments = new Map<number, Comment[]>();
	#labels = new Set<string>();
	#refs = new Map<string, string>([["heads/main", "c0"]]);
	#commits = new Map<string, { message: string; tree: { sha: string }; parents: string[] }>([["c0", { message: "base", tree: { sha: "t0" }, parents: [] }]]);
	#pulls: Pull[] = [];
	#version = 1;
	#tick = 0;
	readonly requests: string[] = [];
	/** The next `count` requests answer 502. */
	failures = 0;

	// SAFETY: the fake answers the (url, init) calls the adapter makes; it is no full fetch (no preconnect).
	fetch = (async (input: string | URL | Request, init?: RequestInit) => {
		const url = new URL(String(input));
		const method = init?.method ?? "GET";
		const headers = new Headers(init?.headers);
		const body = Body.parse(init?.body ? JSON.parse(String(init.body)) : {});
		const path = url.pathname.replace(`/repos/${this.repo}`, "");

		this.requests.push(`${method} ${url.pathname}${url.search}`);

		if (this.failures > 0) {
			this.failures--;

			return new Response("bad gateway", { status: 502 });
		}

		if (headers.get("authorization") !== "Bearer fake-token") return reply(401, { message: "Bad credentials" });

		if (url.pathname === "/rate_limit") return reply(200, { resources: { core: { remaining: this.remaining } } });

		const answer = this.#route(method, path, url.searchParams, body, headers);

		if (answer.status !== 304) this.remaining--;

		return answer;
	}) as typeof fetch;

	/** A person's issue: ready for hum. */
	seed(title: string, { label = "hum:ready" }: { label?: string } = {}): number {
		this.#labels.add(label);
		this.#issues.push({ number: this.#issues.length + this.#pulls.length + 1, title, body: `${title} body`, state: "open", labels: [{ name: label }], updated: ++this.#tick });
		this.#version++;

		return this.#issues.length + this.#pulls.length;
	}

	/** A person's comment on an issue. */
	say(number: number, text: string): void {
		this.#commentOn(number, text);
	}

	/** A branch, as `git push` would make it. */
	branch(name: string): void {
		this.#refs.set(`heads/${name}`, "c0");
	}

	branches(): string[] {
		return [...this.#refs.keys()].map((ref) => ref.slice("heads/".length));
	}

	pulls(): readonly Pull[] {
		return this.#pulls;
	}

	#commentOn(number: number, text: string) {
		const issue = this.#issues.find((found) => found.number === number);

		if (!issue) return undefined;

		const list = this.#comments.get(number) ?? [];
		const comment = { id: list.length + 1, body: text, created_at: new Date(1_700_000_000_000 + ++this.#tick * 1000).toISOString() };

		this.#comments.set(number, [...list, comment]);
		issue.updated = ++this.#tick;
		this.#version++;

		return comment;
	}

	#route(method: string, path: string, query: URLSearchParams, body: Body, headers: Headers): Response {
		const page = <T>(list: T[]) => {
			const per = Number(query.get("per_page") ?? 30);
			const at = Number(query.get("page") ?? 1);

			return list.slice((at - 1) * per, at * per);
		};

		if (method === "GET" && path === "") return reply(200, { default_branch: "main" });

		let match: RegExpExecArray | null;

		if ((match = /^\/labels\/(.+)$/.exec(path)) && method === "GET") return this.#labels.has(decodeURIComponent(match[1] ?? "")) ? reply(200, { name: match[1] ?? "" }) : reply(404, { message: "Not Found" });

		if (path === "/labels" && method === "POST") {
			const name = String(body.name);

			if (this.#labels.has(name)) return reply(422, { message: "already_exists" });

			this.#labels.add(name);

			return reply(201, { name });
		}

		if (path === "/issues" && method === "GET") {
			const state = query.get("state") ?? "open";
			const label = query.get("labels");
			const sorted = [...this.#issues].sort((a, b) => b.updated - a.updated);
			const list = sorted.filter((issue) => (state === "all" || issue.state === state) && (!label || issue.labels.some((l) => l.name === label)));
			const etag = `W/"${createHash("sha1").update(`${this.#version}:${url(query)}`).digest("hex").slice(0, 12)}"`;

			if (headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { etag } });

			return reply(200, page(list), etag);
		}

		if (path === "/issues" && method === "POST") {
			const labels = (body.labels ?? []).map((name) => ({ name }));
			const number = this.#issues.length + this.#pulls.length + 1;

			this.#issues.push({ number, title: String(body.title), body: String(body.body ?? ""), state: "open", labels, updated: ++this.#tick });
			this.#version++;

			return reply(201, this.#issues.at(-1) ?? null);
		}

		if ((match = /^\/issues\/(\d+)$/.exec(path)) && method === "GET") {
			const issue = this.#issues.find((found) => found.number === Number(match?.[1]));

			return issue ? reply(200, issue) : reply(404, { message: "Not Found" });
		}

		if ((match = /^\/issues\/(\d+)\/comments$/.exec(path))) {
			const number = Number(match[1]);

			if (method === "GET") return reply(200, page(this.#comments.get(number) ?? []));

			const made = this.#commentOn(number, String(body.body));

			return made ? reply(201, made) : reply(404, { message: "Not Found" });
		}

		if ((match = /^\/git\/ref\/(.+)$/.exec(path))) {
			const sha = this.#refs.get(match[1] ?? "");

			return sha ? reply(200, { ref: `refs/${match[1]}`, object: { sha } }) : reply(404, { message: "Not Found" });
		}

		if ((match = /^\/git\/matching-refs\/(.+)$/.exec(path))) {
			return reply(200, [...this.#refs].flatMap(([ref, sha]) => (ref.startsWith(match?.[1] ?? "") ? [{ ref: `refs/${ref}`, object: { sha } }] : [])));
		}

		if ((match = /^\/git\/commits\/(.+)$/.exec(path))) {
			const commit = this.#commits.get(match[1] ?? "");

			return commit ? reply(200, { sha: match[1] ?? "", ...commit }) : reply(404, { message: "Not Found" });
		}

		if (path === "/git/commits" && method === "POST") {
			const sha = `c${this.#commits.size}`;

			this.#commits.set(sha, { message: String(body.message), tree: { sha: String(body.tree) }, parents: body.parents ?? [] });

			return reply(201, { sha, ...this.#commits.get(sha) });
		}

		if (path === "/git/refs" && method === "POST") {
			const ref = String(body.ref).replace("refs/", "");

			if (this.#refs.has(ref)) return reply(422, { message: "Reference already exists" });

			this.#refs.set(ref, String(body.sha));

			return reply(201, { ref: body.ref ?? "", object: { sha: body.sha ?? "" } });
		}

		if ((match = /^\/git\/refs\/(.+)$/.exec(path)) && method === "PATCH") {
			const ref = match[1] ?? "";
			const current = this.#refs.get(ref);

			if (!current) return reply(404, { message: "Not Found" });

			if (!this.#commits.get(String(body.sha))?.parents.includes(current)) return reply(422, { message: "Update is not a fast forward" });

			this.#refs.set(ref, String(body.sha));

			return reply(200, { ref: `refs/${ref}`, object: { sha: body.sha ?? "" } });
		}

		if (path === "/pulls" && method === "GET") {
			const head = (query.get("head") ?? "").split(":")[1];

			return reply(200, this.#pulls.filter((pull) => pull.head === head && pull.state === query.get("state")));
		}

		if (path === "/pulls" && method === "POST") {
			this.#pulls.push({ number: this.#issues.length + this.#pulls.length + 1, head: String(body.head), base: String(body.base), title: String(body.title), merged_at: null, state: "open" });

			return reply(201, this.#pulls.at(-1) ?? null);
		}

		if ((match = /^\/pulls\/(\d+)\/merge$/.exec(path)) && method === "PUT") {
			const pull = this.#pulls.find((found) => found.number === Number(match?.[1]));

			if (!pull) return reply(404, { message: "Not Found" });

			Object.assign(pull, { state: "closed", merged_at: "2026-11-07T00:00:00Z" });

			return reply(200, { merged: true });
		}

		return reply(404, { message: `fake GitHub has no ${method} ${path}` });
	}
}

const url = (query: URLSearchParams): string => [...query].filter(([key]) => key !== "page").join("&");

const reply = (status: number, json: Json, etag?: string): Response => new Response(JSON.stringify(json), { status, headers: etag ? { etag } : {} });
