import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
	type Adapter,
	type AdapterContext,
	type Answer,
	type Answers,
	type Claim,
	type ClaimResult,
	type FollowUp,
	type Item,
	ItemId,
	type ItemRef,
	type Questions,
	type Release,
	type WorkSource,
	PermanentError,
	type Question,
	type Watch,
} from "../adapter-api.ts";
import { answerMarker, marked, markerOf, parseComment, questionMarker } from "./marked.ts";

const API = "https://api.github.com";
const CLAIM_PREFIX = "hum/claim";
const PAGE = 100;
const MAX_PAGES = 20;
const READY_LABEL = "hum:ready";

const Label = z.union([z.string(), z.looseObject({ name: z.string() }).transform((label) => label.name)]);

const GitHubIssue = z.looseObject({
	number: z.int().positive(),
	title: z.string(),
	body: z.string().nullable(),
	state: z.enum(["open", "closed"]),
	labels: z.array(Label),
	pull_request: z.unknown().optional(),
});

const GitHubComment = z.looseObject({
	id: z.int(),
	body: z.string().nullable(),
	created_at: z.string(),
});

const GitHubRef = z.looseObject({
	ref: z.string(),
	object: z.looseObject({ sha: z.string() }),
});

const GitHubCommit = z.looseObject({
	sha: z.string(),
	message: z.string(),
	tree: z.looseObject({ sha: z.string() }),
});

const GitHubPull = z.looseObject({
	number: z.int().positive(),
	merged_at: z.string().nullable().optional(),
});

const issueNumber = (id: string): number => {
	ItemId.parse(id);

	if (!/^[1-9]\d*$/.test(id))
		throw new PermanentError(`"${id}" is no GitHub issue number`);

	return Number(id);
};

/** The `owner/name` of a GitHub remote URL, or undefined for any other host. */
export const repoFromRemote = (url: string): string | undefined =>
	/github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/.exec(url.trim())?.[1];

const tokenFromEnvOrGh = async (): Promise<string> => {
	const fromEnv = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

	if (fromEnv) return fromEnv;

	const gh = Bun.spawn(["gh", "auth", "token"], {
		stdout: "pipe",
		stderr: "pipe",
	});

	const token = (await new Response(gh.stdout).text()).trim();

	if ((await gh.exited) !== 0 || token === "")
		throw new PermanentError(
			"no GitHub login: run `gh auth login`, or set GH_TOKEN",
		);

	return token;
};

export type GitHubApiOptions = {
	readonly repo: string;
	/** Replaces `fetch`, for a fake GitHub. */
	readonly fetch?: typeof fetch | undefined;
	readonly token?: () => Promise<string>;
	readonly api?: string;
};

export type Reply = {
	readonly status: number;
	readonly etag: string | undefined;
	readonly json: unknown;
};

/** One repo's REST API on the owner's own login. It counts the requests that spent rate limit: a 304 spends none. */
export class GitHubApi {
	readonly repo: string;
	readonly #fetch: typeof fetch;
	readonly #token: () => Promise<string>;
	readonly #root: string;
	#spent = 0;
	#cached: Promise<string> | undefined;

	constructor({
		repo,
		fetch: send = fetch,
		token = tokenFromEnvOrGh,
		api = API,
	}: GitHubApiOptions) {
		if (!/^[\w.-]+\/[\w.-]+$/.test(repo))
			throw new PermanentError(
				`"${repo}" is no GitHub repo; expected owner/name`,
			);

		this.repo = repo;
		this.#fetch = send;
		this.#root = api;
		this.#token = () => (this.#cached ??= token());
	}

	spent(): number {
		return this.#spent;
	}

	/**
	 * Statuses in `allow` come back as replies. Any other 4xx is a `PermanentError`;
	 * a 5xx, a rate limit or a dropped connection is a plain error, which the engine retries.
	 */
	async call(
		method: string,
		path: string,
		{
			body,
			etag,
			allow = [],
		}: { body?: unknown; etag?: string; allow?: readonly number[] } = {},
	): Promise<Reply> {
		const headers = new Headers({
			accept: "application/vnd.github+json",
			authorization: `Bearer ${await this.#token()}`,
			"x-github-api-version": "2022-11-28",
			"user-agent": "hum",
		});

		if (etag !== undefined) headers.set("if-none-match", etag);

		if (body !== undefined) headers.set("content-type", "application/json");

		const response = await this.#fetch(`${this.#root}${path}`, {
			method,
			headers,
			body: body === undefined ? undefined : JSON.stringify(body),
		});

		const status = response.status;

		if (status !== 304 && path !== "/rate_limit") this.#spent++;

		const text = status === 304 || status === 204 ? "" : await response.text();

		const json: unknown =
			text === ""
				? undefined
				: (() => {
						try {
							return JSON.parse(text);
						} catch {
							return undefined;
						}
					})();

		if (
			(status >= 200 && status < 300) ||
			status === 304 ||
			allow.includes(status)
		)
			return { status, etag: response.headers.get("etag") ?? undefined, json };

		const detail = `${method} ${path}: ${status} ${text.slice(0, 200)}`;

		const limited =
			status === 429 ||
			(status === 403 &&
				(response.headers.get("x-ratelimit-remaining") === "0" ||
					/rate limit/i.test(text)));

		if (limited || status >= 500) throw new Error(detail);

		throw new PermanentError(detail);
	}

	/** Every page of a list endpoint. */
	async pages<T>(path: string, schema: z.ZodType<T>): Promise<T[]> {
		const found: T[] = [];

		for (let page = 1; page <= MAX_PAGES; page++) {
			const { json } = await this.call(
				"GET",
				`${path}${path.includes("?") ? "&" : "?"}per_page=${PAGE}&page=${page}`,
			);

			const list = schema.array().parse(json);

			found.push(...list);

			if (list.length < PAGE) return found;
		}

		throw new PermanentError(
			`${path} has more than ${MAX_PAGES * PAGE} entries`,
		);
	}

	/** The free rate-limit read. */
	async remaining(): Promise<number> {
		const { json } = await this.call("GET", "/rate_limit");

		return z
			.looseObject({
				resources: z.looseObject({
					core: z.looseObject({ remaining: z.int() }),
				}),
			})
			.parse(json).resources.core.remaining;
	}
}

export type GitHubOptions = {
	readonly repo?: string;
	readonly api?: GitHubApi;
	readonly fetch?: typeof fetch;
	/** Where claims branch from and pull requests land. Defaults to the repo's default branch. */
	readonly base?: string;
	/** Open issues with this label are the ready items. */
	readonly readyLabel?: string;
	readonly mergeMethod?: "merge" | "squash" | "rebase";
};

type Whole = Adapter & {
	readonly workSource: WorkSource;
	readonly questions: Questions;
	readonly answers: Answers;
	readonly release: Release;
	readonly spent: () => number;
};

type ClaimRead = {
	readonly sha: string;
	readonly tree: string;
	readonly claim: Claim;
};

/**
 * GitHub on the owner's own login: issues are items, comments are the thread.
 * A claim is the branch `hum/claim/<issue>`: the first POST of the ref wins, a renewal or an expired take is a
 * fast-forward on top, and the commit message holds the holder and the expiry (judged against `context.now`).
 * `watch` is one request with `If-None-Match`; GitHub answers 304 free of rate limit.
 */
export const githubAdapter = (
	options: GitHubOptions,
	{ now }: AdapterContext,
) => {
	const api =
		options.api ??
		new GitHubApi({
			repo: options.repo ?? "",
			fetch: options.fetch,
		});

	const readyLabel = options.readyLabel ?? READY_LABEL;
	const mergeMethod = options.mergeMethod ?? "squash";
	const r = `/repos/${api.repo}`;
	let baseBranch = options.base;
	let labelReady: Promise<void> | undefined;

	const base = async (): Promise<string> => {
		if (baseBranch) return baseBranch;

		const { json } = await api.call("GET", r);

		baseBranch = z
			.looseObject({ default_branch: z.string() })
			.parse(json).default_branch;

		return baseBranch;
	};

	const ensureLabel = () =>
		(labelReady ??= (async () => {
			const found = await api.call(
				"GET",
				`${r}/labels/${encodeURIComponent(readyLabel)}`,
				{ allow: [404] },
			);

			if (found.status === 404)
				await api.call("POST", `${r}/labels`, {
					body: {
						name: readyLabel,
						color: "0e8a16",
						description: "hum may take this item",
					},
					allow: [422],
				});
		})().catch((error: Error) => {
			labelReady = undefined;
			throw error;
		}));

	const issue = async (id: string) => {
		const { status, json } = await api.call(
			"GET",
			`${r}/issues/${issueNumber(id)}`,
			{ allow: [404] },
		);

		if (status === 404)
			throw new PermanentError(`no issue ${id} in ${api.repo}`);

		const parsed = GitHubIssue.parse(json);

		if (parsed.pull_request !== undefined)
			throw new PermanentError(`${id} is a pull request, not an item`);

		return parsed;
	};

	const readClaim = async (id: string): Promise<ClaimRead | undefined> => {
		const ref = await api.call(
			"GET",
			`${r}/git/ref/heads/${CLAIM_PREFIX}/${issueNumber(id)}`,
			{ allow: [404] },
		);

		return ref.status === 404
			? undefined
			: claimAt(id, GitHubRef.parse(ref.json).object.sha);
	};

	const claimAt = async (id: string, sha: string): Promise<ClaimRead> => {
		const commit = GitHubCommit.parse(
			(await api.call("GET", `${r}/git/commits/${sha}`)).json,
		);

		const match = /^hum-claim (\S+) (\d+)/.exec(commit.message);

		if (!match)
			throw new PermanentError(
				`${CLAIM_PREFIX}/${id} holds no hum claim: ${commit.message.split("\n")[0]}`,
			);

		return {
			sha,
			tree: commit.tree.sha,
			claim: { item: id, holder: match[1] ?? "", expiresAt: Number(match[2]) },
		};
	};

	const live = (read: ClaimRead | undefined): boolean =>
		read !== undefined && read.claim.expiresAt > now();

	const post = (id: string, body: string) =>
		api.call("POST", `${r}/issues/${issueNumber(id)}/comments`, {
			body: { body },
		});

	const take = async (
		id: string,
		holder: string,
		ttlMs: number,
		renew: boolean,
	): Promise<ClaimResult> => {
		const number = issueNumber(id);

		if (!Number.isInteger(ttlMs) || ttlMs <= 0)
			throw new PermanentError(
				`a claim lasts a positive whole number of milliseconds, not ${ttlMs}`,
			);

		if (!/^[A-Za-z0-9][\w.@:-]{0,99}$/.test(holder))
			throw new PermanentError(`holder "${holder}" is not a plain name`);

		const current = await readClaim(id);

		if (live(current) && current?.claim.holder !== holder)
			return { won: false, claim: current!.claim };

		if (renew && current?.claim.holder !== holder) {
			if (current) return { won: false, claim: current.claim };

			throw new PermanentError(`"${holder}" holds no claim on "${id}"`);
		}

		let parent = current?.sha;
		let tree = current?.tree;

		if (!current) {
			const found = await issue(id);

			if (
				found.state !== "open" ||
				!found.labels.includes(readyLabel)
			)
				throw new PermanentError(
					`issue ${id} is not open and labelled ${readyLabel}`,
				);

			const head = GitHubRef.parse(
				(await api.call("GET", `${r}/git/ref/heads/${await base()}`)).json,
			).object.sha;

			parent = head;
			tree = GitHubCommit.parse(
				(await api.call("GET", `${r}/git/commits/${head}`)).json,
			).tree.sha;
		}

		const expiresAt = now() + ttlMs;

		const made = GitHubCommit.parse(
			(
				await api.call("POST", `${r}/git/commits`, {
					body: {
						message: `hum-claim ${holder} ${expiresAt}\n\nnonce: ${randomUUID()}`,
						tree,
						parents: [parent],
					},
				})
			).json,
		);

		const branch = `${CLAIM_PREFIX}/${number}`;

		const moved = current
			? await api.call("PATCH", `${r}/git/refs/heads/${branch}`, {
					body: { sha: made.sha, force: false },
					allow: [404, 422],
				})
			: await api.call("POST", `${r}/git/refs`, {
					body: { ref: `refs/heads/${branch}`, sha: made.sha },
					allow: [422],
				});

		if (moved.status === 200 || moved.status === 201)
			return { won: true, claim: { item: id, holder, expiresAt } };

		const winner = await readClaim(id);

		if (!winner)
			throw new PermanentError(
				`claim on "${id}" lost a race to a claim that has since vanished`,
			);

		return { won: false, claim: winner.claim };
	};

	const pullFor = async (ref: string, state: "open" | "closed") => {
		const owner = api.repo.split("/")[0];

		const list = GitHubPull.array().parse(
			(
				await api.call(
					"GET",
					`${r}/pulls?state=${state}&head=${encodeURIComponent(`${owner}:${ref}`)}`,
				)
			).json,
		);

		return list[0];
	};

	const adapter: Whole = {
		apiVersion: 1,
		spent: () => api.spent(),
		workSource: {
			async listReady() {
				const issues = await api.pages(
					`${r}/issues?state=open&labels=${encodeURIComponent(readyLabel)}`,
					GitHubIssue,
				);

				const items = issues.filter(
					(found) => found.pull_request === undefined,
				);

				if (items.length === 0) return [];

				const claimed = new Map(
					GitHubRef.array()
						.parse(
							(
								await api.call(
									"GET",
									`${r}/git/matching-refs/heads/${CLAIM_PREFIX}/`,
								)
							).json,
						)
						.map(
							(ref) =>
								[
									ref.ref.slice(`refs/heads/${CLAIM_PREFIX}/`.length),
									ref.object.sha,
								] as const,
						),
				);

				const ready: ItemRef[] = [];

				for (const found of items) {
					const id = String(found.number);
					const sha = claimed.get(id);

					if (sha === undefined || !live(await claimAt(id, sha)))
						ready.push({ id, title: found.title });
				}

				return ready;
			},
			async read(id): Promise<Item> {
				const found = await issue(id);

				const comments = await api.pages(
					`${r}/issues/${issueNumber(id)}/comments`,
					GitHubComment,
				);

				const claim = await readClaim(id);

				return {
					id,
					title: found.title,
					body: found.body ?? "",
					ready:
						found.state === "open" &&
						found.labels.includes(readyLabel) &&
						!live(claim),
					thread: comments.map((comment) =>
						parseComment(comment.body, Date.parse(comment.created_at)),
					),
				};
			},
			claim: (id, holder, ttlMs) => take(id, holder, ttlMs, false),
			renew: (id, holder, ttlMs) => take(id, holder, ttlMs, true),
			async comment(id, text) {
				await post(id, text.trim() === "" ? "(empty)" : text.trim());
			},
			async fileFollowUp(
				from: string,
				{ title, body }: FollowUp,
			): Promise<ItemRef> {
				const key = createHash("sha256")
					.update(title)
					.digest("hex")
					.slice(0, 12);

				const filed = (
					await api.pages(
						`${r}/issues/${issueNumber(from)}/comments`,
						GitHubComment,
					)
				).flatMap((comment) => {
					const follow = markerOf(comment.body)?.followUp;

					return follow?.key === key ? [follow.item] : [];
				});

				if (filed[0] !== undefined) return { id: filed[0], title };

				await ensureLabel();

				const made = GitHubIssue.parse(
					(
						await api.call("POST", `${r}/issues`, {
							body: {
								title,
								body: `${body.trim()}\n\nFiled from #${from}.`,
								labels: [readyLabel],
							},
						})
					).json,
				);

				await post(
					from,
					marked(
						{ kind: "comment", followUp: { key, item: String(made.number) } },
						`Filed follow-up #${made.number}: ${title}`,
					),
				);

				return { id: String(made.number), title };
			},
		},
		questions: {
			ask: async (id, { text, options }: Question) =>
				void (await post(
					id,
					marked(
						questionMarker(options),
						options?.length
							? `${text}\n\nOptions: ${options.join(", ")}`
							: text,
					),
				)),
			decide: async (id, text) =>
				void (await post(id, marked({ kind: "decision" }, text))),
		},
		answers: {
			answer: async (id, { text, option }: Answer) =>
				void (await post(
					id,
					marked(
						answerMarker(option),
						text,
					),
				)),
			/** U2: one request. Any comment or issue change moves the newest issue's `updated_at`, so the list's ETag moves. A 304 spends no rate limit (U2a). */
			async watch(since?: string): Promise<Watch> {
				const reply = await api.call(
					"GET",
					`${r}/issues?state=all&sort=updated&direction=desc&per_page=1`,
					since === undefined ? {} : { etag: since },
				);

				if (reply.status === 304 && since !== undefined)
					return { token: since, changed: false };

				if (!reply.etag)
					throw new PermanentError(
						"GitHub sent no ETag on the issue list, so watch has nothing to compare",
					);

				return { token: reply.etag, changed: reply.etag !== since };
			},
		},
		release: {
			async publish(id, ref) {
				if ((await pullFor(ref, "open")) !== undefined) return;

				const found = await issue(id);

				await api.call("POST", `${r}/pulls`, {
					body: {
						title: found.title,
						head: ref,
						base: await base(),
						body: `Closes #${id}`,
					},
				});
			},
			async release(id, ref) {
				const open = await pullFor(ref, "open");

				if (!open) {
					if ((await pullFor(ref, "closed"))?.merged_at) return;

					throw new PermanentError(
						`no pull request from ${ref} to release for item ${id}`,
					);
				}

				await api.call("PUT", `${r}/pulls/${open.number}/merge`, {
					body: { merge_method: mergeMethod },
				});
			},
		},
	};

	return adapter;
};
