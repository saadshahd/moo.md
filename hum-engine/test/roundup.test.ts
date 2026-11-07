import { afterAll, describe, expect, test } from "bun:test";
import { z } from "zod";
import { type AdapterContext, contractChecks, type ContractTarget, roundupAdapter, stdioCall, type ToolCall } from "../src/index.ts";
import { FakeRoundup } from "./fixtures/fake-roundup.ts";

const clock = { offset: 0 };
const now = () => Date.now() + clock.offset;
const context: AdapterContext = { report: () => {}, now };

describe("contract suite on a fake roundup", () => {
	const roundup = new FakeRoundup();
	const primary = roundupAdapter({ call: roundup.call }, context);
	const secondary = roundupAdapter({ call: roundup.call }, context);

	const target: ContractTarget = {
		name: "roundup (fake)",
		adapter: primary,
		other: async () => secondary,
		seed: async (title) => String(roundup.seed(title)),
		advance: async (ms) => void (clock.offset += ms),
		spent: primary.spent,
	};

	for (const check of contractChecks(target)) test(check.name, check.run);
});

describe("what a Todo needs to be ready", () => {
	test("a done, blocked or assigned Todo is not listed and cannot be claimed", async () => {
		const roundup = new FakeRoundup();
		const adapter = roundupAdapter({ call: roundup.call }, context);
		const open = roundup.seed("open");
		const done = roundup.seed("done", { done: true });
		const blocked = roundup.seed("blocked", { blocked: true });
		const owned = roundup.seed("owned", { owner: { kind: "agent", id: "7" } });

		expect((await adapter.workSource.listReady()).map((ref) => ref.id)).toEqual([String(open)]);

		for (const id of [done, blocked, owned]) await expect(adapter.workSource.claim(String(id), "a", 1000)).rejects.toThrow("not ready to claim");
	});

	test("claim comments stay off the thread, and a person's reply reads as a comment", async () => {
		const roundup = new FakeRoundup();
		const adapter = roundupAdapter({ call: roundup.call }, context);
		const id = roundup.seed("threaded");

		await adapter.workSource.claim(String(id), "a", 1000);
		await adapter.questions.ask(String(id), { text: "Which?", options: ["approve", "change"] });
		roundup.say(id, "approve please");

		const { thread } = await adapter.workSource.read(String(id));

		expect(thread.map((entry) => entry.kind)).toEqual(["question", "comment"]);
	});
});

describe("a roundup comment is one line", () => {
	test("text that is too long or spans lines is refused, never cut", async () => {
		const roundup = new FakeRoundup();
		const adapter = roundupAdapter({ call: roundup.call }, context);
		const id = String(roundup.seed("short"));

		await expect(adapter.workSource.comment(id, "x".repeat(300))).rejects.toThrow("at most 280");
		await expect(adapter.workSource.comment(id, "two\nlines")).rejects.toThrow("one line");
		await expect(adapter.questions.ask(id, { text: "y".repeat(300) })).rejects.toThrow("hold 280 characters");
		expect((await adapter.workSource.read(id)).thread).toEqual([]);
	});
});

describe("watch", () => {
	test("an idle watch makes no write and keeps its token; a comment flips it", async () => {
		const roundup = new FakeRoundup();
		const adapter = roundupAdapter({ call: roundup.call }, context);
		const id = roundup.seed("watched");
		const first = await adapter.answers.watch();

		expect(await adapter.answers.watch(first.token)).toEqual({ token: first.token, changed: false });

		roundup.say(id, "from the app");

		expect((await adapter.answers.watch(first.token)).changed).toBe(true);
	});
});

describe("refusal", () => {
	test("outside a run roundup started, the stdio adapter refuses", () => {
		const saved = { agent: process.env.ROUNDUP_AGENT_ID, socket: process.env.RUPD_SOCKET };

		delete process.env.ROUNDUP_AGENT_ID;
		delete process.env.RUPD_SOCKET;

		try {
			expect(() => roundupAdapter({}, context)).toThrow("only in a run roundup started");
		} finally {
			if (saved.agent !== undefined) process.env.ROUNDUP_AGENT_ID = saved.agent;

			if (saved.socket !== undefined) process.env.RUPD_SOCKET = saved.socket;
		}
	});
});

const Live = z.object({ HUM_LIVE: z.literal("1"), HUM_ROUNDUP_SOCKET: z.string().min(1), HUM_ROUNDUP_AGENT: z.string().min(1) });

const env = Live.safeParse(process.env);

if (!env.success) console.log("skip live roundup contract: set HUM_LIVE=1, HUM_ROUNDUP_SOCKET (the scratch Project's daemon socket) and HUM_ROUNDUP_AGENT (an Agent id in that Project)");

const Created = z.looseObject({ id: z.int() });

describe.skipIf(!env.success)("contract suite on the scratch roundup Project (live)", () => {
	let stdio: ReturnType<typeof stdioCall> | undefined;
	const created: number[] = [];

	const client = () => {
		if (!env.success) throw new Error("the live roundup test needs its environment");

		return (stdio ??= stdioCall({ socket: env.data.HUM_ROUNDUP_SOCKET, agent: env.data.HUM_ROUNDUP_AGENT }));
	};

	const call: ToolCall = async (name, args) => {
		const result = await client().call(name, args);

		if (name === "todo_create") created.push(Created.parse(result).id);

		return result;
	};

	const adapter = roundupAdapter({ call }, context);
	const second = roundupAdapter({ call }, context);

	afterAll(async () => {
		if (created.length > 0) await client().call("todo_delete", { operation: `hum-contract-${Date.now()}`, ids: created });

		await stdio?.close();
	}, 60_000);

	test("the target is the scratch Project, not moo.md", async () => {
		expect(JSON.stringify(await call("agent_context", {}))).toContain("project=hum-roundup-scratch");
	});

	const target: ContractTarget = {
		name: "roundup (scratch Project)",
		adapter,
		other: async () => second,
		seed: async (title) => String(Created.parse(await call("todo_create", { title, body: `${title} body` })).id),
		advance: async (ms) => void (clock.offset += ms),
		spent: adapter.spent,
	};

	for (const check of contractChecks(target)) test(check.name, check.run, 60_000);
});
