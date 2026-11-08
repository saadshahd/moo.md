import { docsJudge } from "./fixtures/judge.ts";
import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { type Adapter, type Item, PermanentError } from "../src/adapter-api.ts";
import { guarded } from "../src/adapters/guard.ts";
import { onceCalls } from "../src/adapters/once.ts";
import { serialized } from "../src/adapters/serial.ts";
import { openState } from "../src/state/open.ts";
import { openWorker } from "../src/worker/open.ts";
import { configWith, hopeSkills, rawConfig } from "./fixtures/config.ts";
import { sh } from "./fixtures/work-repo.ts";
import { NOW, TTL, workerWorld, type WorkerWorld } from "./fixtures/worker-world.ts";
import { readHeartbeat, readStatus } from "../src/status/file.ts";

const worlds: WorkerWorld[] = [];
const temp: string[] = [];

const world = async (...args: Parameters<typeof workerWorld>) => {
	const w = await workerWorld(...args);

	worlds.push(w);

	return w;
};

afterEach(() => {
	for (const w of worlds.splice(0)) w.clean();

	for (const dir of temp.splice(0)) rmSync(dir, { recursive: true, force: true });
});

type Write = { readonly name: string; readonly kind: string; readonly call: (a: Adapter, id: string, text: string) => Promise<void> };

const WRITES: readonly Write[] = [
	{ name: "comment", kind: "comment", call: (a, id, text) => a.workSource!.comment(id, text) },
	{ name: "ask", kind: "question", call: (a, id, text) => a.questions!.ask(id, { text }) },
	{ name: "decide", kind: "decision", call: (a, id, text) => a.questions!.decide(id, text) },
	{ name: "answer", kind: "answer", call: (a, id, text) => a.answers!.answer(id, { text }) },
];

/** The adapter does the write, or not, and then the process "dies". */
const dying = (real: Adapter, writeFirst: boolean): Adapter => {
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
	test(`${write.name} runs once per scope, and a retry after a crash reads the thread before it writes again`, async () => {
		const w = await world({});
		const id = w.repo.seed("An item");
		const scope = { run: "t", attempt: 0 };
		const entries = async () => (await w.adapter.workSource!.read(id)).thread.filter((e) => e.kind === write.kind).length;

		// Twice in one scope: one write.
		const calls = onceCalls(w.adapter, w.state.ops, scope);

		await write.call(calls, id, "one");
		await write.call(calls, id, "one");
		expect(await entries()).toBe(1);

		// Died after the write: the retry finds the entry and writes nothing.
		const after = onceCalls(w.adapter, w.state.ops, { run: "after", attempt: 0 });

		await expect(write.call(onceCalls(dying(w.adapter, true), w.state.ops, { run: "after", attempt: 0 }), id, "two")).rejects.toThrow("died");
		await write.call(after, id, "two");
		expect(await entries()).toBe(2);

		// Died before the write: the retry finds no entry and writes one.
		await expect(write.call(onceCalls(dying(w.adapter, false), w.state.ops, { run: "before", attempt: 0 }), id, "three")).rejects.toThrow("died");
		expect(await entries()).toBe(2);
		await write.call(onceCalls(w.adapter, w.state.ops, { run: "before", attempt: 0 }), id, "three");
		expect(await entries()).toBe(3);
	});
}

const item = (id: string): Item => ({ id, title: id, body: "", ready: true, thread: [] });

test("the last-read list survives a restart: a fresh guard still sees an empty list that contradicts it", async () => {
	const state = openState(mkdtempSync(join(tmpdir(), "hum-r3-")));

	temp.push(state.dir);

	const store = { load: () => state.ready.get("work-source")?.ids ?? [], save: (ids: string[]) => state.ready.put("work-source", { ids }) };

	const listing = (ids: string[]): Adapter => ({
		apiVersion: 1,
		workSource: {
			listReady: async () => ids.map((id) => ({ id, title: id })),
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
	const w = await world({ items: { a: { commitForItem: true, askUnlessAnswered: "Which?" } } });

	w.item("a", "docs/a.md");
	await w.worker.tick();
	await w.worker.idle();
	expect(w.results.at(-1)).toMatchObject({ outcome: "asked" });
	expect(w.state.kinds.get("docs@1")).toBeDefined();

	// The owner changes the machine to version 2 and answers; a new worker starts on the new config.
	const next = configWith((raw) => {
		raw.kinds.docs.machine.version = "2";
	});

	await w.adapter.answers!.answer("a", { text: "Use Plain" });
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

	const w = await world({ items: { a: { commitForItem: true, modelTokens: 699, askUnlessAnswered: "Which?" } } }, { config });

	w.item("a", "docs/a.md");
	await w.worker.tick();
	await w.worker.idle();
	expect(w.state.spent.get("a")).toEqual({ item: "a", total: 700, base: 0 });

	// A restart and an answer: the second run spends 700 more, which a per-call count would allow too, but the total is kept.
	await w.adapter.answers!.answer("a", { text: "Use Plain" });
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

	const w = await world({ items: { a: { commitForItem: true, modelTokens: 599 } } }, { config, checks: ["false"] });

	w.item("a", "docs/a.md");
	await w.worker.tick();
	await w.worker.idle();

	// build 600, then the fix run is capped at the 400 left and goes over: the item asks the owner.
	expect(w.results.at(-1)).toMatchObject({ outcome: "asked" });
	expect(w.state.spent.get("a")?.total).toBe(1200);

	const thread = (await w.adapter.workSource!.read("a")).thread;

	expect(thread.map((e) => e.kind)).toEqual(["question"]);
	expect(thread[0]?.text).toContain("token cap");
});

test("three items on one role start one after the other's first token, not together", async () => {
	const behavior = { commitForItem: true, spend: 5, beforeToken: 700, sleep: 100 };
	const w = await world({ items: { a: behavior, b: behavior, c: behavior } });

	w.item("a", "docs/a.md");
	w.item("b", "docs/b.md");
	w.item("c", "docs/c.md");
	await w.worker.tick();
	await w.worker.idle();

	const starts = w.shim.calls().filter((call) => call.itemId).map((call) => call.at).sort();

	expect(starts).toHaveLength(3);
	// The second and third waited for the first one's token (700 ms in), and then went together.
	expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(600);
	expect(starts[2]! - starts[1]!).toBeLessThan(600);
	expect(w.results.filter((r) => r.outcome === "merged")).toHaveLength(3);
});

test("openWorker wires a repo: state in .git/hum, the config in .hum/, the markdown source, a started runner", async () => {
	const w = await world({ items: { a: { commitForItem: true, spend: 5 } } });
	const raw = rawConfig();

	const put = (path: string, text: string) => {
		mkdirSync(dirname(join(w.repo.owner, path)), { recursive: true });
		writeFileSync(join(w.repo.owner, path), text);
	};

	put(".hum/hum.json", JSON.stringify(raw.hum));

	for (const [name, kind] of Object.entries(raw.kinds)) put(`.hum/kinds/${name}.json`, JSON.stringify(kind));

	for (const [file, text] of Object.entries<string>(raw.roles)) put(`.hum/${file}`, text);

	w.item("a", "docs/a.md");

	const results: string[] = [];

	const worker = await openWorker(w.repo.owner, {
		hopeSkills: hopeSkills(),
		judge: docsJudge,
		checks: ["true"],
		holder: "worker-1",
		binary: w.shim.binary,
		env: w.shim.env,
		now: () => NOW,
		workDir: mkdtempSync(join(tmpdir(), "hum-open-work-")),
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
	expect(serialized).toBeDefined();
});
