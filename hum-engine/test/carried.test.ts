import { randomUUID } from "node:crypto";
import { docsJudge } from "./fixtures/judge.ts";
import { expect, test } from "bun:test";
import { existsSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ADAPTER_API_VERSION, type Adapter, Holder, type Integrations, type Item, ItemId, PermanentError } from "../src/adapter-api.ts";
import { guarded } from "../src/adapters/guard.ts";
import { onceCalls } from "../src/adapters/once.ts";
import { openState } from "../src/state/open.ts";
import { openWorker } from "../src/worker/open.ts";
import { configWith, installedSkills, rawConfig, writeConfigDir } from "./fixtures/config.ts";
import { sh } from "./fixtures/work-repo.ts";
import { NOW, TTL, workerWorld } from "./fixtures/worker-world.ts";
import { readHeartbeat, readStatus } from "../src/status/file.ts";
import { tempDir } from "./fixtures/temp.ts";

type Write = { readonly name: string; readonly kind: string; readonly call: (a: Integrations, id: string, text: string) => Promise<void> };

const WRITES: readonly Write[] = [
	{ name: "comment", kind: "comment", call: (a, id, text) => a.workSource!.comment(ItemId.parse(id), text) },
	{ name: "ask", kind: "question", call: (a, id, text) => a.questions!.ask(ItemId.parse(id), { text }) },
	{ name: "decide", kind: "decision", call: (a, id, text) => a.questions!.decide(ItemId.parse(id), text) },
	{ name: "answer", kind: "answer", call: (a, id, text) => a.answers!.answer(ItemId.parse(id), { text }) },
];

/** The adapter does the write, or not, and then the process "dies". */
const dying = (real: Integrations, { writeFirst }: { readonly writeFirst: boolean }): Integrations => {
	const die = async (write: () => Promise<void>) => {
		if (writeFirst) await write();

		throw new Error("the process died");
	};

	return {
		apiVersion: real.apiVersion,
		workSource: { ...real.workSource!, comment: (id, text) => die(() => real.workSource!.comment(id, text)) },
		questions: { ask: (id, q) => die(() => real.questions!.ask(id, q)), decide: (id, t) => die(() => real.questions!.decide(id, t)) },
		answers: { ...real.answers!, answer: (id, a) => die(() => real.answers!.answer(id, a)) },
	};
};

for (const write of WRITES) {
	const thread = async () => {
		const w = await workerWorld({});
		const id = w.repo.seed("An item");
		const entries = async () => (await w.adapter.workSource!.read(id)).thread.filter((e) => e.kind === write.kind).length;
		const calls = (adapter: Integrations, run: string) => onceCalls(adapter, w.state.ops, { run, attempt: 0 });

		return { w, id, entries, calls };
	};

	test(`${write.name} runs once per scope`, async () => {
		const { w, id, entries, calls } = await thread();
		const scoped = calls(w.adapter, "t");

		await write.call(scoped, id, "one");
		await write.call(scoped, id, "one");
		expect(await entries()).toBe(1);
	});

	test(`${write.name} retried after a crash past the write reads the thread and writes nothing`, async () => {
		const { w, id, entries, calls } = await thread();

		await expect(write.call(calls(dying(w.adapter, { writeFirst: true }), "after"), id, "two")).rejects.toThrow("died");
		await write.call(calls(w.adapter, "after"), id, "two");
		expect(await entries()).toBe(1);
	});

	test(`${write.name} retried after a crash before the write writes once`, async () => {
		const { w, id, entries, calls } = await thread();

		await expect(write.call(calls(dying(w.adapter, { writeFirst: false }), "before"), id, "three")).rejects.toThrow("died");
		expect(await entries()).toBe(0);
		await write.call(calls(w.adapter, "before"), id, "three");
		expect(await entries()).toBe(1);
	});
}

const item = (id: string): Item => ({ id: ItemId.parse(id), title: id, body: "", ready: true, thread: [] });

test("the last-read list survives a restart: a fresh guard still sees an empty list that contradicts it", async () => {
	const state = openState(tempDir("r3"), { now: Date.now });

	const store = { load: () => state.ready.get("work-source")?.ids ?? [], save: (ids: string[]) => state.ready.put("work-source", { ids }) };

	const listing = (ids: string[]): Adapter => ({
		apiVersion: ADAPTER_API_VERSION,
		workSource: {
			listReady: async () => ids.map((id) => ({ id: ItemId.parse(id), title: id })),
			read: async (id) => item(id),
			claim: async () => {
				throw new Error("unused");
			},
			renew: async () => {
				throw new Error("unused");
			},
			comment: async () => {},
			fileFollowUp: async () => {
				throw new Error("unused");
			},
			finish: async () => {},
		},
	});

	const guard = () => ({ provider: "p", faults: state.faults, timeoutMs: 1000, lastReady: store });

	await guarded(listing(["a"]), guard()).workSource!.listReady();

	// A restarted worker has a new guard; the saved list is what it remembers.
	await expect(guarded(listing([]), guard()).workSource!.listReady()).rejects.toThrow(PermanentError);
	expect(state.faults.list().map((c) => c.code)).toEqual(["empty-list"]);

	// Contrast: with nothing saved, the same empty list passes as "no work".
	expect(await guarded(listing([]), { provider: "q", faults: state.faults, timeoutMs: 1000 }).workSource!.listReady()).toEqual([]);
});

test("an item saved under an earlier machine version restores through the kinds the worker kept", async () => {
	const w = await workerWorld({ items: { a: { writeForItem: true, askUnlessAnswered: "Which?" } } });

	w.item("a", "docs/a.md");
	await w.worker.tick();
	await w.worker.idle();
	expect(w.results.at(-1)).toMatchObject({ outcome: "asked" });
	expect(w.state.kinds.get("docs@1")).toBeDefined();

	// The owner changes the machine to version 2 and answers; a new worker starts on the new config.
	const next = configWith((raw) => {
		raw.kinds.docs.machine.version = "2";
	});

	await w.adapter.answers!.answer(ItemId.parse("a"), { text: "Use Plain" });
	w.clock.at += TTL + 1;

	const restarted = w.workerWith({ config: next });

	await restarted.tick();
	await restarted.idle();

	expect(w.results.at(-1)).toMatchObject({ outcome: "merged", item: "a" });
	expect(w.state.faults.list().map((c) => c.code)).not.toContain("snapshot-machine-unknown");
	expect(w.state.kinds.get("docs@2")).toBeDefined();
});

test("an item's token total is saved over all its runs and restarts; the cap counts what it spent since the owner answered", async () => {
	const config = configWith((raw) => {
		raw.kinds.docs.tokenCap.tokens = 1000;
	});

	const w = await workerWorld({ items: { a: { writeForItem: true, modelTokens: 699, askUnlessAnswered: "Which?" } } }, { config });

	w.item("a", "docs/a.md");
	await w.worker.tick();
	await w.worker.idle();
	expect(w.state.spent.get("a")).toEqual({ item: "a", total: 700, base: 0 });

	// A restart and an answer: the second run spends 700 more, which a per-call count would allow too, but the total is kept.
	await w.adapter.answers!.answer(ItemId.parse("a"), { text: "Use Plain" });
	w.clock.at += TTL + 1;

	const restarted = w.workerWith();

	await restarted.tick();
	await restarted.idle();

	expect(w.results.at(-1)).toMatchObject({ outcome: "merged" });
	expect(w.state.spent.get("a")).toEqual({ item: "a", total: 1400, base: 700 });
});

test("runs in one cycle add up across restarts: the second run of a cycle gets only what the first left, and passing it asks the owner", async () => {
	const config = configWith((raw) => {
		raw.kinds.docs.tokenCap.tokens = 1000;
	});

	const w = await workerWorld({ items: { a: { writeForItem: true, modelTokens: 599 } } }, { config, checks: ["false"] });

	w.item("a", "docs/a.md");
	await w.worker.tick();
	await w.worker.idle();

	// build 600, then the fix run is capped at the 400 left and goes over: the item asks the owner.
	expect(w.results.at(-1)).toMatchObject({ outcome: "asked" });
	expect(w.state.spent.get("a")?.total).toBe(1200);

	const thread = (await w.adapter.workSource!.read(ItemId.parse("a"))).thread;

	expect(thread.map((e) => e.kind)).toEqual(["question"]);
	expect(thread[0]?.text).toContain("token cap");
});

test("three items on one role start one after the other's first token, not together", async () => {
	const behavior = { writeForItem: true, spend: 5, beforeToken: 300 };
	const w = await workerWorld({ items: { a: behavior, b: behavior, c: behavior } });

	w.item("a", "docs/a.md");
	w.item("b", "docs/b.md");
	w.item("c", "docs/c.md");
	await w.worker.tick();
	await w.worker.idle();

	for (const _ of ["the second landing, which lost the race to main", "the third"]) {
		await w.worker.tick();
		await w.worker.idle();
	}

	const [first, second, third] = w.shim.calls().filter((call) => call.itemId).sort((a, b) => a.at - b.at);
	const tokens = new Map(w.shim.tokens().map(({ pid, at }) => [pid, at]));

	// The second and third waited for the first one's token; that they then go together, scheduler.test.ts proves on the gate itself.
	expect(second!.at).toBeGreaterThanOrEqual(tokens.get(first!.pid)!);
	expect(third!.at).toBeGreaterThanOrEqual(tokens.get(first!.pid)!);
	expect(w.results.filter((r) => r.outcome === "merged")).toHaveLength(3);
});

test("openWorker wires a repo: state in .git/hum, the config in .hum/, the markdown source, a started runner", async () => {
	const w = await workerWorld({ items: { a: { writeForItem: true, spend: 5 } } });

	writeConfigDir(join(w.repo.owner, ".hum"), rawConfig((raw) => void (raw.hum.backgroundPollSeconds = 0.05)));

	w.item("a", "docs/a.md");

	const results: string[] = [];

	const worker = await openWorker(w.repo.owner, {
		installedSkills: installedSkills(),
		judge: docsJudge,
		holder: Holder.parse("worker-1"),
		binary: w.shim.binary,
		env: w.shim.env,
		now: () => NOW,
		newSessionId: randomUUID,
		workDir: tempDir("open-work"),
		onResult: (r) => results.push(r.outcome),
	});

	await worker.tick();
	await worker.idle();

	expect(results).toEqual(["merged"]);
	expect(sh(w.repo.remote, ["show", "main:docs/a.md"])).toBe("from a\n");

	// On the Mac, saved state lives in .git/hum.
	const folder = join(w.repo.owner, ".git", "hum");

	expect(existsSync(join(folder, "heartbeat.json"))).toBe(true);
	expect(readHeartbeat(join(folder, "heartbeat.json"))?.configHash).toHaveLength(64);

	const status = readStatus(join(folder, "status.json"));

	expect(status.ok && status.status.workers.mac).toBe(NOW);
});

test("openWorker refuses a repo whose hum.json names no commit identity, saying which setting", async () => {
	const w = await workerWorld({});
	const { hum } = rawConfig((raw) => void delete raw.hum.commitIdentity);

	mkdirSync(join(w.repo.owner, ".hum"), { recursive: true });
	writeFileSync(join(w.repo.owner, ".hum", "hum.json"), JSON.stringify(hum));

	await expect(openWorker(w.repo.owner, { installedSkills: installedSkills(), judge: docsJudge, holder: Holder.parse("worker-1"), binary: w.shim.binary, env: w.shim.env, now: () => NOW, newSessionId: randomUUID })).rejects.toThrow("commitIdentity");
});

test("openWorker with run slots enabled builds the pool: the run starts in a slot and the worker keeps slots ready", async () => {
	const w = await workerWorld({ items: { a: { writeForItem: true, spend: 5 } } });
	const pool = tempDir("open-pool");

	writeConfigDir(
		join(w.repo.owner, ".hum"),
		rawConfig((raw) => {
			raw.hum.backgroundPollSeconds = 0.05;
			raw.hum.runSlots = { ...raw.hum.runSlots, enabled: true, pool, recipe: { ...raw.hum.runSlots.recipe, refresh: [{ when: "always", run: "sleep 0.5" }] } };
		}),
	);

	w.item("a", "docs/a.md");

	const results: string[] = [];

	const worker = await openWorker(w.repo.owner, {
		installedSkills: installedSkills(),
		judge: docsJudge,
		holder: Holder.parse("worker-1"),
		binary: w.shim.binary,
		env: w.shim.env,
		now: () => NOW,
		newSessionId: randomUUID,
		workDir: tempDir("open-work"),
		onResult: (r) => results.push(r.outcome),
	});

	await worker.tick();
	await worker.idle();

	expect(results).toEqual(["merged"]);

	const folders = w.shim.background().filter(({ cmd }) => cmd === "bg").map(({ cwd }) => cwd ?? "");

	expect(folders.filter((folder) => folder.startsWith(realpathSync(pool)))).not.toEqual([]);
	expect(openState(join(w.repo.owner, ".git", "hum"), { now: () => NOW }).slots.list().filter(({ status }) => status !== "free")).toEqual([]);
});
