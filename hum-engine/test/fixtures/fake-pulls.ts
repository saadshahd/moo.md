import { z } from "zod";
import { gitHubClient } from "../../src/adapters/github.ts";
import { gitHubPullRequests, type PullRequests } from "../../src/adapters/pull-requests.ts";
import type { Json } from "../../src/config/json.ts";
import { SHIPPED_COMMAND_TIMEOUT_MS } from "../../src/exec.ts";

type FakePull = { id: string; number: number; head: string; base: string; title: string; state: "OPEN" | "MERGED" | "CLOSED"; autoMerge: boolean; status: "CLEAN" | "BLOCKED" | "BEHIND" };

const Request = z.object({ query: z.string(), variables: z.record(z.string(), z.unknown()).default({}) });

const Vars = z.looseObject({ head: z.string().optional(), base: z.string().optional(), title: z.string().optional(), pull: z.string().optional() });

const json = (status: number, value: Json) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

const node = (pull: FakePull): Json => ({
	id: pull.id,
	number: pull.number,
	url: `https://github.com/me/scratch/pull/${pull.number}`,
	state: pull.state,
	mergeStateStatus: pull.status,
	autoMergeRequest: pull.autoMerge ? { enabledAt: "2026-11-08T00:00:00Z" } : null,
});

/**
 * GitHub's branch rules and pull requests for one repo, behind a `fetch`. A new pull request waits on its required
 * checks (`BLOCKED`); `checksPass` makes it `CLEAN`, and merges it when auto-merge is on, as GitHub does.
 */
export class FakePulls {
	requiresPullRequest = false;
	allowAutoMerge = true;
	readonly pulls: FakePull[] = [];
	/** Each request: `GET /path` for REST, `graphql <operation>` for GraphQL. */
	readonly requests: string[] = [];

	// SAFETY: the fake answers the (url, init) calls Octokit makes; it is no full fetch (no preconnect).
	readonly fetch = (async (input: string | URL | Request, init?: RequestInit) => {
		const url = new URL(String(input));

		if (url.pathname !== "/graphql") {
			this.requests.push(`${init?.method ?? "GET"} ${url.pathname}`);

			return json(200, this.requiresPullRequest ? [{ type: "pull_request", parameters: { allowed_merge_methods: ["squash"] } }, { type: "required_status_checks" }] : [{ type: "deletion" }]);
		}

		const { query, variables } = Request.parse(JSON.parse(String(init?.body)));
		const operation = /^\s*(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? "";
		const v = Vars.parse(variables);

		this.requests.push(`graphql ${operation}`);

		const failure = this.#refusal(operation, v);

		if (failure) return json(200, { data: null, errors: [{ type: "UNPROCESSABLE", message: failure }] });

		return json(200, { data: this.#operations[operation]?.(v) ?? null });
	}) as typeof fetch;

	readonly operations = {
		PullsFrom: (v: z.infer<typeof Vars>) => ({ repository: { id: "R_fake", pullRequests: { nodes: this.pulls.filter((p) => p.head === v.head).toReversed().slice(0, 1).map(node) } } }),
		OpenPull: (v: z.infer<typeof Vars>) => {
			const pull: FakePull = { id: `PR_${this.pulls.length + 1}`, number: this.pulls.length + 1, head: v.head ?? "", base: v.base ?? "", title: v.title ?? "", state: "OPEN", autoMerge: false, status: "BLOCKED" };

			this.pulls.push(pull);

			return { createPullRequest: { pullRequest: node(pull) } };
		},
		EnableAutoMerge: (v: z.infer<typeof Vars>) => this.#acknowledge(v, { autoMerge: true }, "enablePullRequestAutoMerge"),
		DisableAutoMerge: (v: z.infer<typeof Vars>) => this.#acknowledge(v, { autoMerge: false }, "disablePullRequestAutoMerge"),
		MergeNow: (v: z.infer<typeof Vars>) => this.#acknowledge(v, { state: "MERGED" }, "mergePullRequest"),
		Comment: () => ({ addComment: { clientMutationId: null } }),
		UpdateBranch: (v: z.infer<typeof Vars>) => this.#acknowledge(v, { status: "BLOCKED" }, "updatePullRequestBranch"),
	};

	readonly #operations: Readonly<Record<string, (v: z.infer<typeof Vars>) => Json>> = this.operations;

	#refusal(operation: string, v: z.infer<typeof Vars>): string | undefined {
		const pull = this.pulls.find((p) => p.id === v.pull);

		if (operation !== "EnableAutoMerge" || !pull) return undefined;

		if (!this.allowAutoMerge) return "Pull request Auto merge is not allowed for this repository";

		return pull.status === "CLEAN" ? "Pull request Pull request is in clean status" : undefined;
	}

	#acknowledge(v: z.infer<typeof Vars>, change: Partial<FakePull>, mutation: string): Json {
		this.#set(v, change);

		return { [mutation]: { clientMutationId: null } };
	}

	#set(v: z.infer<typeof Vars>, change: Partial<FakePull>): void {
		const pull = this.pulls.find((p) => p.id === v.pull);

		if (pull) Object.assign(pull, change);
	}

	/** The required checks pass: an armed pull request merges, any other may merge now. */
	checksPass(number: number): void {
		const pull = this.pulls.find((p) => p.number === number);

		if (pull) Object.assign(pull, pull.autoMerge ? { state: "MERGED" } : { status: "CLEAN" });
	}

	client(): PullRequests {
		return gitHubPullRequests("me/scratch", { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS, client: gitHubClient({ token: "fake-token", fetch: this.fetch, spaced: false, timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS }) });
	}
}
