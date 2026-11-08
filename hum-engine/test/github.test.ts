import { afterAll, describe, expect, test } from "bun:test";
import { z } from "zod";
import { type AdapterContext, contractChecks, type ContractTarget, type GitHubClient, gitHubClient, githubAdapter, type GitHubOptions, parseComment, repoFromRemote } from "../src/index.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { FakeGitHub } from "./fixtures/fake-github.ts";

const clock = { offset: 0 };
const now = () => Date.now() + clock.offset;
const context: AdapterContext = { report: () => {}, now };

const fakeClient = (github: FakeGitHub, token = "fake-token"): GitHubClient => gitHubClient({ token, baseUrl: "https://fake.github", fetch: github.fetch, spaced: false });

const settings = (repo: string, client: GitHubClient): GitHubOptions => ({
	repo,
	base: "main",
	client,
	claimPrefix: SHIPPED_DEFAULTS.claimPrefix,
	readyLabel: SHIPPED_DEFAULTS.readyLabel,
	mergeMethod: SHIPPED_DEFAULTS.mergeMethod,
});

const onFake = (github: FakeGitHub, client = fakeClient(github)) => githubAdapter(settings(github.repo, client), context);

describe("contract suite on a fake GitHub", () => {
	const github = new FakeGitHub();
	const primary = onFake(github);
	const secondary = onFake(github);

	const target: ContractTarget = {
		name: "github (fake)",
		adapter: primary,
		other: async () => secondary,
		seed: async (title) => String(github.seed(title)),
		advance: async (ms) => void (clock.offset += ms),
		spent: () => primary.spent(),
	};

	for (const check of contractChecks(target)) test(check.name, check.run);

	test("publish opens one pull request, and release merges it", async () => {
		const id = String(github.seed("shipped"));

		github.branch("hum/run/shipped");
		await primary.release.publish(id, "hum/run/shipped");
		await primary.release.publish(id, "hum/run/shipped");

		expect(github.pulls().filter((pull) => pull.head === "hum/run/shipped")).toHaveLength(1);

		await primary.release.release(id, "hum/run/shipped");
		await primary.release.release(id, "hum/run/shipped");

		expect(github.pulls().find((pull) => pull.head === "hum/run/shipped")?.state).toBe("MERGED");
		await expect(primary.release.release(id, "hum/run/none")).rejects.toThrow("no pull request");
	});
});

describe("claims", () => {
	test("a claim is a branch under the claim prefix, and an expired claim goes to the first writer on its head", async () => {
		const github = new FakeGitHub();
		const a = onFake(github);
		const b = onFake(github);
		const id = String(github.seed("branchy"));

		expect((await a.workSource.claim(id, "a", 1000)).won).toBe(true);
		expect(github.branches()).toContain(`${SHIPPED_DEFAULTS.claimPrefix}${id}`);

		clock.offset += 2000;

		const raced = await Promise.all([a.workSource.claim(id, "a2", 1000), b.workSource.claim(id, "b2", 1000)]);

		expect(raced.filter((result) => result.won)).toHaveLength(1);
	});

	test("a claim prefix from the settings names the claim branch", async () => {
		const github = new FakeGitHub();
		const adapter = githubAdapter({ ...settings(github.repo, fakeClient(github)), claimPrefix: "bots/take/" }, context);
		const id = String(github.seed("renamed"));

		await adapter.workSource.claim(id, "a", 1000);

		expect(github.branches()).toContain(`bots/take/${id}`);
		expect((await adapter.workSource.listReady()).map((ref) => ref.id)).not.toContain(id);
	});

	test("an issue without the ready label cannot be claimed", async () => {
		const github = new FakeGitHub();
		const id = String(github.seed("plain", { label: "bug" }));

		await expect(onFake(github).workSource.claim(id, "a", 1000)).rejects.toThrow("not ready to claim");
	});
});

describe("the thread", () => {
	test("hum's marker carries kind and option, a decision is marked too, and a person's comment reads as a comment", async () => {
		const github = new FakeGitHub();
		const adapter = onFake(github);
		const id = String(github.seed("thread"));

		await adapter.questions.ask(id, { text: "Which?", options: ["approve", "change"] });
		await adapter.answers.answer(id, { text: "ok", option: "approve" });
		await adapter.questions.decide(id, "went with approve");
		github.say(Number(id), 'a web reply <!-- hum {"kind":"answer"} -->');

		const { thread } = await adapter.workSource.read(id);
		const bodies = github.comments(Number(id)).map((comment) => comment.body);

		expect(thread.map((entry) => entry.kind)).toEqual(["question", "answer", "decision", "comment"]);
		expect(bodies[0]?.split("\n")[0]).toBe('<!-- hum {"kind":"question","options":["approve","change"]} -->');
		expect(parseComment(bodies[2] ?? "", 0).kind).toBe("decision");
		expect(thread[0]?.text).toContain("Options: approve, change");
		expect(thread[1]?.option).toBe("approve");
	});

	test("one read is one GraphQL query, and one comment one mutation", async () => {
		const github = new FakeGitHub();
		const adapter = onFake(github);
		const id = String(github.seed("counted"));

		await adapter.workSource.read(id);
		await adapter.workSource.comment(id, "once");

		expect(github.requests).toEqual(["graphql Item", "graphql AddComment"]);
	});

	test("repoFromRemote reads https and ssh remotes, and refuses other hosts", () => {
		expect(repoFromRemote("https://github.com/saadshahd/factory-smoke.git")).toBe("saadshahd/factory-smoke");
		expect(repoFromRemote("git@github.com:saadshahd/factory-smoke.git")).toBe("saadshahd/factory-smoke");
		expect(repoFromRemote("https://gitlab.com/a/b.git")).toBeUndefined();
	});
});

describe("failures", () => {
	test("a rejected login is permanent, not retried", async () => {
		const github = new FakeGitHub();

		await expect(onFake(github, fakeClient(github, "wrong")).workSource.listReady()).rejects.toThrow("Bad credentials");
		expect(github.requests).toEqual([]);
	});

	test("a client on GitHub's own terms spaces its GraphQL requests", async () => {
		const github = new FakeGitHub();
		const adapter = githubAdapter(settings(github.repo, gitHubClient({ token: "fake-token", baseUrl: "https://fake.github", fetch: github.fetch })), context);
		const id = String(github.seed("spaced"));
		const started = Date.now();

		await adapter.workSource.read(id);
		await adapter.workSource.read(id);

		expect(Date.now() - started).toBeGreaterThanOrEqual(900);
	});
});

const live = process.env.HUM_LIVE === "1";
const scratch = process.env.HUM_GITHUB_SCRATCH ?? "saadshahd/factory-smoke";

if (!live) console.log("skip live GitHub contract: set HUM_LIVE=1 to run it on saadshahd/factory-smoke (writes issues, comments and claim branches, then deletes them)");

const RateLimit = z.object({ resources: z.object({ core: z.object({ used: z.int() }) }) });
const RepositoryReply = z.object({ repository: z.object({ id: z.string(), label: z.object({ id: z.string() }).nullable() }) });
const Created = z.object({ createIssue: z.object({ issue: z.object({ number: z.int() }) }) });
const IssueReply = z.object({ repository: z.object({ issue: z.object({ id: z.string() }) }) });

describe.skipIf(!live)(`contract suite on ${scratch} (live)`, () => {
	const [owner = "", name = ""] = scratch.split("/");
	const token = Bun.spawnSync(["gh", "auth", "token"]).stdout.toString().trim();
	const client = gitHubClient({ token });
	const otherClient = gitHubClient({ token });
	const primary = githubAdapter(settings(scratch, client), context);
	const secondary = githubAdapter(settings(scratch, otherClient), context);

	/** Every issue either client creates, seeded or filed as a follow-up, so cleanup deletes them all. */
	const made = new Set<number>();

	for (const each of [client, otherClient]) {
		each.hook.after("request", (response) => {
			const created = z.object({ data: Created }).safeParse(response.data);

			if (created.success) made.add(created.data.data.createIssue.issue.number);
		});
	}

	const used = async () => RateLimit.parse((await client.request("GET /rate_limit")).data).resources;

	/** GitHub's reads lag its writes by seconds, so a test polls for the effect instead of guessing. */
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

	const seed = async (title: string): Promise<string> => {
		const { repository } = RepositoryReply.parse(
			await client.graphql(`query($owner: String!, $name: String!, $label: String!) { repository(owner: $owner, name: $name) { id label(name: $label) { id } } }`, { owner, name, label: SHIPPED_DEFAULTS.readyLabel }),
		);

		const label =
			repository.label?.id ??
			z.object({ createLabel: z.object({ label: z.object({ id: z.string() }) }) }).parse(
				await client.graphql(`mutation($repository: ID!, $name: String!) { createLabel(input: { repositoryId: $repository, name: $name, color: "0e8a16" }) { label { id } } }`, { repository: repository.id, name: SHIPPED_DEFAULTS.readyLabel }),
			).createLabel.label.id;

		const { issue } = Created.parse(
			await client.graphql(`mutation($repository: ID!, $title: String!, $label: ID!) { createIssue(input: { repositoryId: $repository, title: $title, body: "scratch", labelIds: [$label] }) { issue { id number } } }`, { repository: repository.id, title, label }),
		).createIssue;

		await settle(async () => (await primary.workSource.listReady()).some((ref) => ref.id === String(issue.number)));
		await quiet();

		return String(issue.number);
	};

	const target: ContractTarget = {
		name: `github (${scratch})`,
		adapter: { ...primary, release: undefined },
		other: async () => secondary,
		seed,
		advance: async (ms) => void (clock.offset += ms),
		spent: () => primary.spent(),
		settle,
	};

	afterAll(async () => {
		for (const number of made) {
			await client.request("DELETE /repos/{owner}/{repo}/git/refs/{ref}", { owner, repo: name, ref: `heads/${SHIPPED_DEFAULTS.claimPrefix}${number}` }).catch(() => undefined);

			const { id } = IssueReply.parse(await client.graphql(`query($owner: String!, $name: String!, $number: Int!) { repository(owner: $owner, name: $name) { issue(number: $number) { id } } }`, { owner, name, number })).repository.issue;

			await client.graphql(`mutation($id: ID!) { deleteIssue(input: { issueId: $id }) { clientMutationId } }`, { id });
		}
	}, 120_000);

	for (const check of contractChecks(target)) test(check.name, check.run, 90_000);

	test("30 idle watches spend none of the rate limit", async () => {
		await quiet();

		const first = await primary.answers.watch();

		await Bun.sleep(2000);

		const before = await used();
		const spent = primary.spent();
		const polls = await Promise.all(Array.from({ length: 30 }, () => primary.answers.watch(first.token)));

		expect(polls.every((poll) => !poll.changed)).toBe(true);
		expect(primary.spent()).toBe(spent);
		expect((await used()).core.used - before.core.used).toBeLessThan(10);
	}, 60_000);

	test("the points one worker tick spends, idle and busy", async () => {
		const id = await seed("ticked");

		await quiet();

		const token = (await primary.answers.watch()).token;
		const sent: ("query" | "mutation" | "rest" | "not-modified")[] = [];
		const kindOf = (options: { url: string; query?: string }) => (options.url !== "/graphql" ? "rest" : /^\s*mutation/.test(options.query ?? "") ? "mutation" : "query");

		client.hook.after("request", (_response, options) => void sent.push(kindOf(options)));
		client.hook.error("request", (error, options) => {
			sent.push("status" in error && error.status === 304 ? "not-modified" : kindOf(options));

			throw error;
		});

		/**
		 * Counts the requests one tick sends. GitHub's account-wide counters lag and count other clients, so the
		 * client's own requests are the measure: each query hum sends costs one GraphQL point by GitHub's dry run.
		 */
		const measure = async <T>(tick: () => Promise<T>) => {
			sent.length = 0;
			await tick();

			const count = (kind: string) => sent.filter((request) => request === kind).length;

			return { queries: count("query"), mutations: count("mutation"), rest: count("rest"), notModified: count("not-modified") };
		};

		const idle = await measure(() => primary.answers.watch(token));

		const claiming = await measure(async () => {
			await primary.answers.watch(token);
			await primary.workSource.listReady();
			await primary.workSource.claim(id, "worker-a", 60_000);
			await primary.workSource.read(id);
		});

		const renewing = await measure(async () => {
			await primary.answers.watch(token);
			await primary.workSource.listReady();
			await primary.workSource.renew(id, "worker-a", 60_000);
		});

		console.log(`points per tick on ${scratch}: idle ${JSON.stringify(idle)}; claim and read ${JSON.stringify(claiming)}; renew ${JSON.stringify(renewing)}`);
		expect(idle).toEqual({ queries: 0, mutations: 0, rest: 0, notModified: 1 });
	}, 120_000);
});
