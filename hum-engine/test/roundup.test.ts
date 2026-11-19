import { afterAll, describe, expect, test } from "bun:test";
import { z } from "zod";
import { type AdapterContext, contractChecks, type ContractTarget, roundupAdapter, stdioCall, type ToolCall } from "../src/index.ts";
import { FakeRoundup } from "./fixtures/fake-roundup.ts";
import { Holder, ItemId } from "../src/adapter-api.ts";

const clock = { offset: 0 };
const now = () => Date.now() + clock.offset;
const context: AdapterContext = { report: () => {}, now, env: process.env };

/** The Agent each stubbed adapter acts as, and the owner that hands a Todo to it. */
const AGENT = "7";
const MINE = { kind: "agent", id: AGENT };

describe("contract suite on a fake roundup", () => {
	const roundup = new FakeRoundup();
	const primary = roundupAdapter({ call: roundup.call, agent: AGENT }, context);
	const secondary = roundupAdapter({ call: roundup.call, agent: AGENT }, context);

	const target: ContractTarget = {
		name: "roundup (fake)",
		adapter: primary,
		other: async () => secondary,
		seed: async (title) => ItemId.parse(String(roundup.seed(title, { owner: MINE }))),
		advance: async (ms) => void (clock.offset += ms),
		spent: primary.spent,
	};

	for (const check of contractChecks(target)) test(check.name, check.run);
});

describe("what a Todo needs to be ready", () => {
	test("only an open, unblocked Todo hum's Agent owns is listed; any other cannot be claimed", async () => {
		const roundup = new FakeRoundup();
		const adapter = roundupAdapter({ call: roundup.call, agent: AGENT }, context);
		const mine = roundup.seed("mine", { owner: MINE });
		const unowned = roundup.seed("unowned");
		const another = roundup.seed("another Agent's", { owner: { kind: "agent", id: "8" } });
		const user = roundup.seed("the user's, under the same id", { owner: { kind: "user", id: AGENT } });
		const done = roundup.seed("done", { owner: MINE, done: true });
		const blocked = roundup.seed("blocked", { owner: MINE, blocked: true });

		expect((await adapter.workSource.listReady()).map((ref) => ref.id)).toEqual([ItemId.parse(String(mine))]);

		for (const id of [unowned, another, user, done, blocked]) await expect(adapter.workSource.claim(ItemId.parse(String(id)), Holder.parse("a"), 1000)).rejects.toThrow("not ready to claim");
	});

	test("claim comments stay off the thread, and a person's reply reads as a comment", async () => {
		const roundup = new FakeRoundup();
		const adapter = roundupAdapter({ call: roundup.call, agent: AGENT }, context);
		const id = roundup.seed("threaded", { owner: MINE });

		await adapter.workSource.claim(ItemId.parse(String(id)), Holder.parse("a"), 1000);
		await adapter.questions.ask(ItemId.parse(String(id)), { text: "Which?", options: ["approve", "change"] });
		roundup.say(id, "approve please");

		const { thread } = await adapter.workSource.read(ItemId.parse(String(id)));

		expect(thread.map((entry) => entry.kind)).toEqual(["question", "comment"]);
	});

	test("a claim a newer worker wrote with a field this engine does not know still holds the Todo", async () => {
		const roundup = new FakeRoundup();
		const adapter = roundupAdapter({ call: roundup.call, agent: AGENT }, context);
		const id = roundup.seed("claimed", { owner: MINE });

		roundup.say(id, `<!-- hum-claim ${JSON.stringify({ holder: "newer", at: now(), expiresAt: now() + 60_000, addedLater: true })} -->`);

		expect((await adapter.workSource.claim(ItemId.parse(String(id)), Holder.parse("older"), 1000)).won).toBe(false);
	});
});

describe("follow-ups", () => {
	test("a follow-up filed again after its note failed to post is the Todo already created", async () => {
		const roundup = new FakeRoundup();
		const adapter = roundupAdapter({ call: roundup.call, agent: AGENT }, context);
		const from = String(roundup.seed("origin"));

		roundup.failsOnce.add("todo_comment");

		await expect(adapter.workSource.fileFollowUp(ItemId.parse(from), { title: "Fix it", body: "Do it." })).rejects.toThrow();

		const again = await adapter.workSource.fileFollowUp(ItemId.parse(from), { title: "Fix it", body: "Do it." });

		expect(roundup.calls.filter((tool) => tool === "todo_create")).toHaveLength(1);
		expect(await adapter.workSource.fileFollowUp(ItemId.parse(from), { title: "Fix it", body: "Do it." })).toEqual(again);
	});
});

describe("a roundup comment is one line", () => {
	test("a question or reply that fits is one comment, whole", async () => {
		const roundup = new FakeRoundup();
		const adapter = roundupAdapter({ call: roundup.call, agent: AGENT }, context);
		const id = String(roundup.seed("short"));

		await adapter.questions.ask(ItemId.parse(id), { text: "Which title?", options: ["a", "b"] });
		await adapter.workSource.comment(ItemId.parse(id), "Answer 1 applied: a.");

		expect((await adapter.workSource.read(ItemId.parse(id))).thread.map((entry) => entry.text)).toEqual(["Which title? Options: a, b", "Answer 1 applied: a."]);
		expect(roundup.pads.size).toBe(0);
	});

	test("one that is too long or spans lines goes whole into a Pad, and its comment names the Pad", async () => {
		const roundup = new FakeRoundup();
		const adapter = roundupAdapter({ call: roundup.call, agent: AGENT }, context);
		const id = String(roundup.seed("short"));
		const detail = "why ".repeat(120);

		await adapter.questions.ask(ItemId.parse(id), { text: "Which title?", options: ["a", "b"], detail });
		await adapter.workSource.comment(ItemId.parse(id), "two\nlines");

		const [question, reply] = (await adapter.workSource.read(ItemId.parse(id))).thread;
		const names = [...roundup.pads.keys()];

		expect(names).toHaveLength(2);
		expect(roundup.pads.get(names[0] ?? "")).toContain(detail.trim());
		expect(question).toMatchObject({ kind: "question" });
		expect(question?.text).toStartWith("Which title?");
		expect(question?.text).toContain(names[0]);
		expect(reply?.text).toContain(names[1]);
		expect(roundup.pads.get(names[1] ?? "")).toBe("two\nlines");
	});
});

describe("refusal", () => {
	const outside: AdapterContext = { ...context, env: {} };

	test("without an Agent to act as, the adapter refuses", () => {
		expect(() => roundupAdapter({ call: new FakeRoundup().call }, outside)).toThrow("ROUNDUP_AGENT_ID is not set");
	});

	test("outside a Terminal roundup started, the stdio adapter refuses", () => {
		expect(() => roundupAdapter({ agent: AGENT }, outside)).toThrow("RUPD_SOCKET is not set");
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

		return (stdio ??= stdioCall({ socket: env.data.HUM_ROUNDUP_SOCKET, agent: env.data.HUM_ROUNDUP_AGENT }, process.env));
	};

	const call: ToolCall = async (name, args) => {
		const result = await client().call(name, args);

		if (name === "todo_create") created.push(Created.parse(result).id);

		return result;
	};

	const agent = env.success ? env.data.HUM_ROUNDUP_AGENT : AGENT;
	const adapter = roundupAdapter({ call, agent }, context);
	const second = roundupAdapter({ call, agent }, context);

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
		seed: async (title) => ItemId.parse(String(Created.parse(await call("todo_create", { title, body: `${title} body`, owner: { kind: "agent", id: agent } })).id)),
		advance: async (ms) => void (clock.offset += ms),
		spent: adapter.spent,
	};

	for (const check of contractChecks(target)) test(check.name, check.run, 60_000);
});
