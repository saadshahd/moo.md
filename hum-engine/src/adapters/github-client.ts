import { Octokit } from "@octokit/core";
import { GraphqlResponseError } from "@octokit/graphql";
import { paginateGraphQL } from "@octokit/plugin-paginate-graphql";
import { type ThrottlingOptions, throttling } from "@octokit/plugin-throttling";
import { RequestError } from "@octokit/request-error";
import pMemoize from "p-memoize";
import { PermanentError } from "../adapter-api.ts";
import type { MERGE_METHODS } from "../config/schema.ts";
import { exec } from "../exec.ts";

const RATE_LIMIT_RETRIES = 1;
const NOT_MODIFIED = 304;

const HumOctokit = Octokit.plugin(throttling, paginateGraphQL);

export type GitHubClient = InstanceType<typeof HumOctokit>;

/** The GraphQL name of each merge method. */
export const MERGE_METHOD = { merge: "MERGE", squash: "SQUASH", rebase: "REBASE" } as const satisfies Record<(typeof MERGE_METHODS)[number], string>;

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

export const failureOf = (cause: unknown): Failure => {
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

/** The owner's own login: `GH_TOKEN` or `GITHUB_TOKEN`, else the token `gh` holds. */
const ownerToken = async (timeoutMs: number): Promise<string> => {
	const fromEnv = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

	if (fromEnv) return fromEnv;

	const gh = await exec("gh", ["auth", "token"], { stdin: "", timeoutMs });
	const token = gh.stdout.trim();

	if (gh.exitCode !== 0 || token === "") throw new PermanentError("no GitHub login: run `gh auth login`, or set GH_TOKEN");

	return token;
};

const retryOnce: NonNullable<ThrottlingOptions["onRateLimit"]> = (_retryAfter, _options, _octokit, retryCount) => retryCount < RATE_LIMIT_RETRIES;

type Send = (url: string, init?: RequestInit) => Promise<Response>;

export type GitHubClientOptions = {
	readonly token: string;
	readonly baseUrl?: string;
	/** Replaces `fetch`, for a GitHub that is not github.com. */
	readonly fetch?: Send;
	/** Whether writes are spaced as GitHub asks; only a GitHub with no secondary rate limit may go without. */
	readonly spaced?: boolean;
	/** The owner's `commandTimeoutSeconds` in milliseconds: how long one request may wait for GitHub's answer. */
	readonly timeoutMs: number;
};

const bounded =
	(send: Send, timeoutMs: number): Send =>
	(url, init) =>
		send(url, { ...init, signal: AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(init?.signal ? [init.signal] : [])]) });

/** A GitHub client that waits out rate limits, spaces its writes as GitHub asks, and gives up on a request GitHub has not answered within `timeoutMs`. */
export const gitHubClient = ({ token, baseUrl, fetch = globalThis.fetch, spaced = true, timeoutMs }: GitHubClientOptions): GitHubClient =>
	new HumOctokit({
		auth: token,
		userAgent: "hum",
		baseUrl,
		request: { fetch: bounded(fetch, timeoutMs) },
		throttle: { enabled: spaced, onRateLimit: retryOnce, onSecondaryRateLimit: retryOnce },
	});

/** The client on the owner's own login, made once per process and `timeoutMs`, so every reader and writer shares its rate-limit spacing. */
export const ownerGitHub = pMemoize(async (timeoutMs: number): Promise<GitHubClient> => gitHubClient({ token: await ownerToken(timeoutMs), timeoutMs }));
