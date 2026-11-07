import { afterAll, describe, expect, test } from "bun:test";
import { z } from "zod";
import { type Adapter, type AdapterContext, contractChecks, type ContractTarget, GitHubApi, githubAdapter, guarded, openState, parseComment, repoFromRemote } from "../src/index.ts";
import { FakeGitHub } from "./fixtures/fake-github.ts";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const Comments = z.array(z.looseObject({ body: z.string() }));
const Created = z.looseObject({ node_id: z.string(), number: z.int() });
const Errored = z.looseObject({ errors: z.array(z.looseObject({})).optional() });

const clock = { offset: 0 };
const now = () => Date.now() + clock.offset;
const context: AdapterContext = { report: () => {}, now };

const fakeApi = (github: FakeGitHub) => new GitHubApi({ repo: github.repo, fetch: github.fetch, token: async () => "fake-token" });

describe("contract suite on a fake GitHub", () => {
	const github = new FakeGitHub();
	const api = fakeApi(github);
	const primary = githubAdapter({ api }, context);
	const secondary = githubAdapter({ api }, context);

	const target: ContractTarget = {
		name: "github (fake)",
		adapter: primary,
		other: async () => secondary,
		seed: async (title) => String(github.seed(title)),
		advance: async (ms) => void (clock.offset += ms),
		spent: () => api.spent(),
	};

	for (const check of contractChecks(target)) test(check.name, check.run);

	test("release: publish opens one pull request, and release merges it", async () => {
		const id = String(github.seed("shipped"));

		github.branch("hum/run/shipped");
		await primary.release?.publish(id, "hum/run/shipped");
		await primary.release?.publish(id, "hum/run/shipped");

		expect(github.pulls().filter((pull) => pull.head === "hum/run/shipped")).toHaveLength(1);

		await primary.release?.release(id, "hum/run/shipped");
		await primary.release?.release(id, "hum/run/shipped");

		expect(github.pulls().find((pull) => pull.head === "hum/run/shipped")?.merged_at).not.toBeNull();
		await expect(primary.release?.release(id, "hum/run/none")).rejects.toThrow("no pull request");
	});
});

describe("U2a: idle watches spend no rate limit", () => {
	test("304s leave the count unchanged, and a comment flips the next watch", async () => {
		const github = new FakeGitHub();
		const adapter = githubAdapter({ api: fakeApi(github) }, context);
		const id = String(github.seed("watched"));
		const first = await adapter.answers.watch();
		const before = github.remaining;

		for (let poll = 0; poll < 9; poll++) expect((await adapter.answers.watch(first.token)).changed).toBe(false);

		expect(github.remaining).toBe(before);
		expect(adapter.spent()).toBe(1);

		github.say(Number(id), "from the web");

		const flipped = await adapter.answers.watch(first.token);

		expect(flipped.changed).toBe(true);
		expect(flipped.token).not.toBe(first.token);
	});
});

describe("claims", () => {
	test("the claim is the branch hum/claim/<issue>, and the winner of an expiry is the first fast-forward", async () => {
		const github = new FakeGitHub();
		const api = fakeApi(github);
		const a = githubAdapter({ api }, context);
		const b = githubAdapter({ api }, context);
		const id = String(github.seed("branchy"));

		expect((await a.workSource.claim(id, "a", 1000)).won).toBe(true);
		expect(github.branches()).toContain(`hum/claim/${id}`);

		clock.offset += 2000;

		const raced = await Promise.all([a.workSource.claim(id, "a2", 1000), b.workSource.claim(id, "b2", 1000)]);

		expect(raced.filter((result) => result.won)).toHaveLength(1);
	});

	test("an issue without the ready label cannot be claimed", async () => {
		const github = new FakeGitHub();
		const adapter = githubAdapter({ api: fakeApi(github) }, context);
		const id = String(github.seed("plain", { label: "bug" }));

		await expect(adapter.workSource.claim(id, "a", 1000)).rejects.toThrow("labelled hum:ready");
	});
});

describe("the thread", () => {
	test("hum's marker carries kind, option and options; a person's comment reads as a comment", async () => {
		const github = new FakeGitHub();
		const adapter = githubAdapter({ api: fakeApi(github) }, context);
		const id = String(github.seed("thread"));

		await adapter.questions.ask(id, { text: "Which?", options: ["approve", "change"] });
		await adapter.answers.answer(id, { text: "ok", option: "approve" });
		github.say(Number(id), "a web reply <!-- hum {\"kind\":\"answer\"} -->");

		const { thread } = await adapter.workSource.read(id);

		expect(thread.map((entry) => entry.kind)).toEqual(["question", "answer", "comment"]);
		expect(thread[0]?.text).toContain("Options: approve, change");
		expect(thread[1]?.option).toBe("approve");
		expect(github.requests.some((request) => request.includes("/comments"))).toBe(true);
	});

	test("an ask posts the options in the hidden marker", async () => {
		const github = new FakeGitHub();
		const adapter = githubAdapter({ api: fakeApi(github) }, context);
		const id = Number(github.seed("marked"));

		await adapter.questions.ask(String(id), { text: "Which?", options: ["approve", "change"] });
		await adapter.questions.decide(String(id), "went with approve");

		const first = await fakeApi(github).call("GET", `/repos/${github.repo}/issues/${id}/comments`);
		const bodies = Comments.parse(first.json).map((comment) => comment.body);

		expect(bodies[0]?.split("\n")[0]).toBe('<!-- hum {"kind":"question","options":["approve","change"]} -->');
		expect(parseComment(bodies[1] ?? "", 0).kind).toBe("decision");
	});

	test("repoFromRemote reads https and ssh remotes, and refuses other hosts", () => {
		expect(repoFromRemote("https://github.com/saadshahd/factory-smoke.git")).toBe("saadshahd/factory-smoke");
		expect(repoFromRemote("git@github.com:saadshahd/factory-smoke.git")).toBe("saadshahd/factory-smoke");
		expect(repoFromRemote("https://gitlab.com/a/b.git")).toBeUndefined();
	});
});

describe("failures", () => {
	test("a 502 is retried by the engine and shows no card inside the timeout", async () => {
		const github = new FakeGitHub();
		const state = openState(mkdtempSync(join(tmpdir(), "hum-gh-")), { now });
		let time = 0;
		const adapter: Adapter = guarded(githubAdapter({ api: fakeApi(github) }, context), { provider: "github", faults: state.faults, timeoutMs: 10_000, now: () => time, sleep: async (ms) => void (time += ms) });

		github.seed("flaky");
		github.failures = 2;

		expect(await adapter.workSource?.listReady()).toHaveLength(1);
		expect(state.faults.list()).toEqual([]);
	});

	test("a rejected login is permanent, not retried", async () => {
		const github = new FakeGitHub();
		const api = new GitHubApi({ repo: github.repo, fetch: github.fetch, token: async () => "wrong" });

		await expect(githubAdapter({ api }, context).workSource.listReady()).rejects.toThrow("401");
	});
});

const live = process.env.HUM_LIVE === "1";
const scratch = process.env.HUM_GITHUB_SCRATCH ?? "saadshahd/factory-smoke";

if (!live) console.log("skip live GitHub contract: set HUM_LIVE=1 to run it on saadshahd/factory-smoke (writes issues, comments and claim branches, then deletes them)");

describe.skipIf(!live)(`contract suite on ${scratch} (live)`, () => {
	const made: string[] = [];
	const claimed = new Set<string>();

	// SAFETY: the recorder forwards the (url, init) calls the adapter makes; it is no full fetch (no preconnect).
	const recording = (async (input: string | URL | Request, init?: RequestInit) => {
		const response = await fetch(input, init);
		const path = new URL(String(input)).pathname;

		if ((init?.method ?? "GET") === "POST" && response.status === 201 && path === `/repos/${scratch}/issues`) {
			const created = Created.parse(await response.clone().json());

			made.push(created.node_id);
			claimed.add(String(created.number));
		}

		return response;
	}) as typeof fetch;

	const api = new GitHubApi({ repo: scratch, fetch: recording });
	const primary = githubAdapter({ api }, context);
	const secondary = githubAdapter({ api }, context);
	const r = `/repos/${scratch}`;

	/** GitHub's cache lags a write by seconds, so a test polls for the effect instead of guessing. */
	const settle = async (until: () => Promise<boolean>) => {
		for (let poll = 0; poll < 40; poll++) {
			if (await until()) return;

			await Bun.sleep(700);
		}

		throw new Error("GitHub never showed the write within 28 s");
	};

	/** Polls until the issue list's ETag has held for four polls in a row. */
	const quiet = async () => {
		let token = (await primary.answers.watch()).token;
		let still = 0;

		while (still < 4) {
			const next = await primary.answers.watch(token);

			token = next.token;
			still = next.changed ? 0 : still + 1;
			await Bun.sleep(700);
		}
	};

	const target: ContractTarget = {
		name: `github (${scratch})`,
		adapter: { ...primary, release: undefined },
		other: async () => secondary,
		seed: async (title) => {
			const label = await api.call("GET", `${r}/labels/hum%3Aready`, { allow: [404] });

			if (label.status === 404) await api.call("POST", `${r}/labels`, { body: { name: "hum:ready", color: "0e8a16" }, allow: [422] });

			const created = Created.parse((await api.call("POST", `${r}/issues`, { body: { title, body: `${title} body`, labels: ["hum:ready"] } })).json);

			await settle(async () => (await primary.workSource.listReady()).some((ref) => ref.id === String(created.number)));
			await quiet();

			return String(created.number);
		},
		advance: async (ms) => void (clock.offset += ms),
		spent: () => api.spent(),
		settle,
	};

	afterAll(async () => {
		for (const number of claimed) await api.call("DELETE", `${r}/git/refs/heads/hum/claim/${number}`, { allow: [404, 422] });

		for (const id of made) {
			const { json } = await api.call("POST", "/graphql", { body: { query: "mutation($id: ID!) { deleteIssue(input: { issueId: $id }) { clientMutationId } }", variables: { id } } });

			if (Errored.parse(json).errors !== undefined) throw new Error(`could not delete scratch issue ${id}: ${JSON.stringify(json)}`);
		}
	}, 60_000);

	for (const check of contractChecks(target)) test(check.name, check.run, 60_000);

	test("U2a: 30 idle 304s spend none of the rate limit, and a write flips the next watch", async () => {
		await quiet();

		const first = await primary.answers.watch();

		await Bun.sleep(2000); // the rate-limit counter lags the request that spent it

		const before = await api.remaining();
		const spent = api.spent();
		const polls = await Promise.all(Array.from({ length: 30 }, () => primary.answers.watch(first.token)));

		expect(polls.every((poll) => !poll.changed)).toBe(true);
		expect(api.spent()).toBe(spent);

		// Other tools spend this login's quota too (about one request a second here); 30 counted polls would cost 30.
		expect(before - (await api.remaining())).toBeLessThan(10);
	}, 60_000);
});
