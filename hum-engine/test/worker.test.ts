import { afterEach, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isAlive, until } from "./fixtures/process.ts";
import { sh } from "./fixtures/work-repo.ts";
import { FakePulls } from "./fixtures/fake-pulls.ts";
import { NOW, TTL, workerWorld, type WorkerWorld } from "./fixtures/worker-world.ts";
import { readHeartbeat, readStatus } from "../src/status/file.ts";

const worlds: WorkerWorld[] = [];

const world = async (...args: Parameters<typeof workerWorld>) => {
	const w = await workerWorld(...args);

	worlds.push(w);

	return w;
};

afterEach(() => {
	for (const w of worlds.splice(0)) w.clean();
});

const merged = (w: WorkerWorld) => w.results.filter((r) => r.outcome === "merged").map((r) => r.item).sort();

test("the thin path runs two items on different files side by side, and both merge", async () => {
	const checkLog = join(tmpdir(), `hum-checks-${process.pid}-${Date.now()}`);
	const w = await world({ items: { a: { commitForItem: true, spend: 5, sleep: 300 }, b: { commitForItem: true, spend: 5, sleep: 300 } } }, { checks: [`echo run >> ${checkLog}`] });

	w.item("a", "docs/a.md");
	w.item("b", "docs/b.md");

	expect(await w.worker.tick()).toEqual({ kind: "ran", started: ["a", "b"] });
	expect(w.worker.running().sort()).toEqual(["a", "b"]);

	await w.worker.idle();

	expect(merged(w)).toEqual(["a", "b"]);
	expect(sh(w.repo.remote, ["show", "main:docs/a.md"])).toBe("from a\n");
	expect(sh(w.repo.remote, ["show", "main:docs/b.md"])).toBe("from b\n");

	// Side by side: each claude process started before the other had ended.
	const [first, second] = w.shim.calls().filter((c) => c.itemId);
	const ends = new Map(w.shim.ends().map((e) => [e.pid, e.at]));

	expect(first!.at).toBeLessThan(ends.get(second!.pid)!);
	expect(second!.at).toBeLessThan(ends.get(first!.pid)!);

	// Each merge is rechecked on the newest main: the later one reran the checks after the earlier one moved it.
	expect(readFileSync(checkLog, "utf8").split("\n").filter(Boolean).length).toBeGreaterThanOrEqual(3);
});

test("a tick that claims, runs and merges an item fetches from the remote once", async () => {
	const w = await world({ items: { a: { commitForItem: true } } });
	const reads = join(w.repo.root, "upload-pack.log");
	const uploadPack = join(w.repo.root, "upload-pack");

	// Git starts upload-pack through `sh -c`, and the dash that is Linux's sh keeps that shell, so the git command is the parent or the grandparent.
	writeFileSync(uploadPack, `#!/bin/sh\nps -o command= -p "$PPID,$(ps -o ppid= -p $PPID | tr -d ' ')" >> ${reads}\nexec git-upload-pack "$@"\n`);
	chmodSync(uploadPack, 0o755);
	sh(w.clone, ["config", "remote.origin.uploadpack", uploadPack]);
	w.item("a", "docs/a.md");

	await w.worker.tick();
	await w.worker.idle();

	expect(merged(w)).toEqual(["a"]);
	expect(readFileSync(reads, "utf8").split("\n").filter((command) => /^git .* fetch /.test(command))).toHaveLength(1);
});

test("an item whose thread cannot be read raises a card naming it, and the other items still start", async () => {
	const w = await world({ items: { a: { commitForItem: true } } });

	w.item("a", "docs/a.md");
	w.state.parked.put("gone", { item: "gone", why: "stuck", cause: "c", since: NOW });

	expect(await w.worker.tick()).toEqual({ kind: "ran", started: ["a"] });
	expect(w.state.faults.list().map(({ code, item }) => ({ code, item }))).toContainEqual({ code: "item-unread", item: "gone" });

	await w.worker.idle();
});

test("items that touch one file go one after the other, and an item that says nothing goes alone", async () => {
	const w = await world({ items: { a: { commitForItem: true, spend: 5 }, b: { commitForItem: true, spend: 5 }, c: { commitForItem: true, spend: 5 } } });

	w.item("a", "docs/shared.md");
	w.item("b", "docs/shared.md");
	w.item("c");

	// a goes first; b clashes with a; c declares nothing, so it clashes with everything.
	expect((await w.worker.tick()).kind).toBe("ran");
	expect(w.worker.running()).toEqual(["a"]);

	await w.worker.idle();
	expect(await w.worker.tick()).toEqual({ kind: "ran", started: ["b"] });
	await w.worker.idle();
	expect(await w.worker.tick()).toEqual({ kind: "ran", started: ["c"] });
	await w.worker.idle();

	expect(merged(w)).toEqual(["a", "b", "c"]);

	const calls = w.shim.calls().filter((c) => c.itemId);
	const ends = new Map(w.shim.ends().map((e) => [e.pid, e.at]));

	expect(calls.map((c) => c.itemId)).toEqual(["a", "b", "c"]);
	expect(calls[1]!.at).toBeGreaterThanOrEqual(ends.get(calls[0]!.pid)!);
	expect(calls[2]!.at).toBeGreaterThanOrEqual(ends.get(calls[1]!.pid)!);
});

test("a merge is rechecked on the newest main: checks that passed on the old main and fail on the new one stop the merge", async () => {
	// b's check passes in b's clone, taken before a merged; once a's file is on main it fails.
	const w = await world({ items: { a: { commitForItem: true, spend: 5 }, b: { commitForItem: true, spend: 5, sleep: 800 } } }, { checks: ["! (test -f docs/a.md && test -f docs/b.md)"] });

	w.item("a", "docs/a.md");
	w.item("b", "docs/b.md");
	await w.worker.tick();
	await w.worker.idle();

	expect(merged(w)).toEqual(["a"]);

	const stopped = w.results.find((r) => r.item === "b");

	expect(stopped).toMatchObject({ outcome: "review" });
	expect(stopped?.detail).toContain("the checks fail on the newest main");
	expect(() => sh(w.repo.remote, ["show", "main:docs/b.md"])).toThrow();
	expect(w.state.parked.get("b")?.why).toBe("review");
});

test("a run's end while a tick is busy brings the next tick once that tick ends", async () => {
	const w = await world({}, { settings: { tickIntervalSeconds: 3600 } });
	const reading = Promise.withResolvers<void>();
	const nextTick = Promise.withResolvers<void>();
	const gate = Promise.withResolvers<void>();
	let listed = 0;

	const listReady = async () => {
		listed++;

		if (listed === 1) {
			reading.resolve();
			await gate.promise;
		}

		if (listed === 2) nextTick.resolve();

		return [];
	};

	const slow = w.workerWith({ adapters: { workSource: { ...w.adapter.workSource!, listReady }, questions: w.adapter.questions!, answers: w.adapter.answers } });
	const stop = new AbortController();
	const served = slow.serve(stop.signal);

	try {
		await reading.promise;
		slow.wake();
		gate.resolve();
		await nextTick.promise;
	} finally {
		stop.abort();
	}

	expect(await served).toEqual({ reason: "stopped" });
});

test("a new engine in node_modules, or an edit under .hum/ or adapters/, makes the worker exit within one tick; item files do not", async () => {
	const w = await world({});

	w.ownerFile("node_modules/@moo.md/hum/package.json", JSON.stringify({ version: "0.1.0" }));
	const worker = w.workerWith({ latestVersion: async () => "0.2.0" });

	expect(await worker.tick()).toEqual({ kind: "ran", started: [] });
	w.ownerFile(".hum/work/new-item.md", "---\ntitle: x\nstate: ready\n---\n");
	expect(await worker.tick()).toEqual({ kind: "ran", started: [] });

	w.ownerFile("node_modules/@moo.md/hum/package.json", JSON.stringify({ version: "0.1.1" }));
	expect(await worker.tick()).toEqual({ kind: "exit", reason: "the engine changed from 0.1.0 to 0.1.1" });

	const beat = readHeartbeat(w.state.heartbeatPath);
	const status = readStatus(w.state.statusPath);

	expect(beat).toMatchObject({ engineVersion: "0.1.1", configHash: w.config.hash, restarting: "the engine changed from 0.1.0 to 0.1.1", inFlight: [] });
	expect(status.ok && status.status.engine).toMatchObject({ version: "0.1.1", latest: "0.2.0" });

	for (const [file, text] of [
		[".hum/memory.md", "never touch vendor/\n"],
		["adapters/mine.ts", "export default () => ({})\n"],
		["bun.lock", "{}\n"],
	] as const) {
		const fresh = w.workerWith();

		w.ownerFile(file, text);
		expect(await fresh.tick(), file).toMatchObject({ kind: "exit" });
	}
});

test("a worker that sees an update starts nothing new, lands nothing and exits when its runs end; the next worker lands the change without a run", async () => {
	const w = await world({ items: { a: { commitForItem: true, spend: 5, sleep: 400 } } }, { settings: { runners: 1 } });

	w.item("a", "docs/a.md");
	w.item("b", "docs/b.md");

	const worker = w.workerWith();

	await worker.tick();
	expect(worker.running()).toEqual(["a"]);

	w.ownerFile(".hum/memory.md", "a new rule\n");
	expect(await worker.tick()).toMatchObject({ kind: "draining" });
	expect(readHeartbeat(w.state.heartbeatPath)?.restarting).toBeDefined();

	await worker.idle();
	expect(await worker.tick()).toMatchObject({ kind: "exit" });
	expect(merged(w)).toEqual([]);

	const next = w.workerWith();

	w.clock.at += w.config.hum.claimExpirySeconds * 1000;
	await next.tick();
	await next.idle();
	expect(merged(w)).toEqual(["a"]);
	expect(w.shim.calls().filter((c) => c.itemId)).toHaveLength(1);
});

test("the status file lists only the newest mergedShown merged changes", async () => {
	const w = await world({ items: { a: { commitForItem: true, spend: 5 }, b: { commitForItem: true, spend: 5 } } }, { settings: { mergedShown: 1 } });

	w.item("a", "docs/a.md");
	w.item("b", "docs/b.md");
	await w.worker.tick();
	await w.worker.idle();
	await w.worker.tick();

	const status = readStatus(w.state.statusPath);

	expect(merged(w)).toEqual(["a", "b"]);
	expect(status.ok && status.status.merged).toHaveLength(1);
});

test("a status read that outlasts statusReadTimeoutSeconds shows no value and never holds the tick", async () => {
	const w = await world({}, { settings: { statusReadTimeoutSeconds: 1 } });
	const worker = w.workerWith({ latestVersion: () => new Promise<never>(() => {}) });
	const began = Date.now();

	await worker.tick();

	const status = readStatus(w.state.statusPath);

	expect(Date.now() - began).toBeLessThan(5000);
	expect(status.ok && status.status.engine.latest).toBeUndefined();
});

test("each tick writes a heartbeat and the status file for the view", async () => {
	const w = await world({});
	const worker = w.workerWith({ latestVersion: async () => "9.9.9" });

	await worker.tick();

	expect(readHeartbeat(w.state.heartbeatPath)).toMatchObject({ time: NOW, configHash: w.config.hash, inFlight: [], intervalMs: w.config.hum.tickIntervalSeconds * 1000 });

	const status = readStatus(w.state.statusPath);

	expect(status.ok && status.status.workers.mac).toBe(NOW);
	expect(status.ok && status.status.engine.latest).toBe("9.9.9");

	w.state.faults.raise({ code: "x", cause: "a cause", fix: "a fix" });
	w.clock.at += 1000;
	await worker.tick();

	const next = readStatus(w.state.statusPath);

	expect(next.ok && next.status.cards.map((c) => c.code)).toEqual(["x"]);
	expect(next.ok && next.status.workers.mac).toBe(NOW + 1000);
});

test("the claim of a run in flight is renewed each tick, and a run whose claim is gone stops", async () => {
	const w = await world({ items: { a: { commitForItem: true, spend: 5, hang: true } } }, { settings: { claimExpirySeconds: 5 } });
	const id = w.item("a", "docs/a.md");
	const worker = w.workerWith();

	await worker.tick();

	await until(() => w.shim.calls().some((c) => c.itemId === id));

	// 3 s on: a tick renews to 8 s. At 6 s the first expiry has passed, yet nobody else can take it.
	w.clock.at += 3000;
	await worker.tick();
	w.clock.at += 3000;
	expect((await w.adapter.workSource!.claim(id, "worker-2", 5000)).won).toBe(false);

	// 10 s on, with no renewal: worker-2 takes it, the next tick finds the claim gone and stops the run.
	w.clock.at += 4000;
	expect((await w.adapter.workSource!.claim(id, "worker-2", 5000)).won).toBe(true);

	const pid = w.shim.calls().find((c) => c.itemId === id)!.pid;

	await worker.tick();
	await worker.idle();

	expect(w.results.find((r) => r.item === id)).toMatchObject({ outcome: "lost" });
	await until(() => !isAlive(pid));
});

test("an item id in the inbox folder wakes a waiting item at once and its question leaves the status file", async () => {
	const answersAdapter = (real: NonNullable<WorkerWorld["adapter"]["answers"]>) => ({ ...real, watch: async () => ({ token: "same", changed: false }) });
	const w = await world({ items: { a: { commitForItem: true, askUnlessAnswered: "Which?" } } });

	w.item("a", "docs/a.md");

	const worker = w.workerWith({ adapters: { workSource: w.adapter.workSource!, questions: w.adapter.questions!, answers: answersAdapter(w.adapter.answers!) } });

	await worker.tick();
	await worker.idle();
	expect(w.results.at(-1)).toMatchObject({ outcome: "asked", item: "a" });

	await w.adapter.answers!.answer("a", { text: "Use Plain" });
	w.clock.at += TTL + 1;

	// Nothing says the answer arrived: the watch reports no change.
	await worker.tick();
	expect(worker.running()).toEqual([]);
	const openBefore = readStatus(w.state.statusPath);

	expect(openBefore.ok && openBefore.status.questions.map(({ item }) => item)).toEqual(["a"]);

	mkdirSync(w.state.inbox, { recursive: true });
	writeFileSync(join(w.state.inbox, "answer-1"), "a\n");
	await worker.tick();
	await worker.idle();

	expect(w.results.at(-1)).toMatchObject({ outcome: "merged", item: "a" });
	expect(existsSync(join(w.state.inbox, "answer-1"))).toBe(false);
	const openAfter = readStatus(w.state.statusPath);

	expect(openAfter.ok && openAfter.status.questions).toEqual([]);
	// The answer was saved as an event before it was acted on.
	expect(w.state.events.list("a").map((e) => e.type)).toContain("answered");
});

test("a saved deadline fires on the next event, not only on a tick: a question the owner never answers ends stuck", async () => {
	const w = await world({ items: { a: { commitForItem: true, askUnlessAnswered: "Which?" } } }, { worker: { ciTick: async () => NOW } });

	w.item("a", "docs/a.md");
	await w.worker.tick();
	await w.worker.idle();
	expect(w.results.at(-1)).toMatchObject({ outcome: "asked" });

	const calls = w.shim.calls().length;

	w.clock.at += 86_400_001;
	await w.worker.tick();

	expect(w.state.parked.get("a")).toMatchObject({ why: "stuck" });
	expect(w.state.faults.list().map((c) => c.code)).toContain("item-stuck");
	expect(w.shim.calls()).toHaveLength(calls);

	const status = readStatus(w.state.statusPath);

	expect(status.ok && w.clock.at - (status.status.workers.ci ?? 0)).toBe(86_400_001);
});

test("a stuck item never reruns until the owner answers; the answer takes it back with a fresh token cap", async () => {
	const flag = join(tmpdir(), `hum-flag-${process.pid}-${Date.now()}`);
	const w = await world({ items: { a: { commitForItem: true, modelTokens: 400 } } }, { checks: [`test -f ${flag}`], settings: { maxFixRuns: 1 } });

	w.item("a", "docs/a.md");
	await w.worker.tick();
	await w.worker.idle();

	expect(w.results.at(-1)).toMatchObject({ outcome: "stuck", item: "a" });

	const spent = w.shim.calls().length;

	expect(w.state.parked.get("a")).toMatchObject({ why: "stuck" });
	expect(w.state.spent.get("a")).toMatchObject({ total: 802, base: 0 });

	// The file still says ready and the claim lapses, yet no tick spends tokens on it.
	for (let tick = 0; tick < 3; tick++) {
		w.clock.at += TTL + 1;
		expect(await w.worker.tick()).toEqual({ kind: "ran", started: [] });
	}

	expect(w.shim.calls()).toHaveLength(spent);

	writeFileSync(flag, "");
	w.clock.at += 1000;
	await w.adapter.answers!.answer("a", { text: "retry" });
	await w.worker.tick();
	await w.worker.idle();

	expect(w.results.at(-1)).toMatchObject({ outcome: "merged", item: "a" });
	expect(w.state.parked.get("a")).toBeUndefined();
	expect(w.state.faults.list().map((c) => c.code)).not.toContain("item-stuck");
	expect(w.state.spent.get("a")).toMatchObject({ total: 1203, base: 802 });
});

test("a limit the runner hit is saved, and a restarted worker makes no call before it ends, then resumes", async () => {
	const until = Math.floor(NOW / 1000) + 3600;
	const w = await world({ items: { a: { error: `Claude usage limit reached|${until}` } } });

	w.item("a", "docs/a.md");
	await w.worker.tick();
	await w.worker.idle();

	expect(w.results.at(-1)).toMatchObject({ outcome: "limited", until: until * 1000 });
	expect(w.state.limit.get("runner")).toEqual({ until: until * 1000 });

	// A fresh process: its own runner, the same saved state.
	const runner = await w.startedRunner();
	const calls = w.shim.calls().length;
	const restarted = w.workerWith({ runner });

	w.clock.at += TTL + 1;
	expect(await restarted.tick()).toEqual({ kind: "ran", started: [] });
	expect(w.shim.calls()).toHaveLength(calls);

	w.clock.at = until * 1000 + 1;
	expect(await restarted.tick()).toEqual({ kind: "ran", started: ["a"] });
	await restarted.idle();
	expect(w.shim.calls().length).toBeGreaterThan(calls);
});

test("a level change re-checks a waiting change once a worker starts on the new config: it lands without another run", async () => {
	const w = await world({ items: { a: { commitForItem: true, spend: 5 } } }, { settings: { paths: [{ glob: "docs/**", level: "high" }] } });

	w.item("a", "docs/a.md");
	await w.worker.tick();
	await w.worker.idle();
	expect(w.results).toMatchObject([{ outcome: "review", item: "a", detail: "level high waits for your review" }]);
	expect(w.state.parked.get("a")?.why).toBe("review");

	const lowered = w.workerWith({ config: { ...w.config, hum: { ...w.config.hum, paths: [{ glob: "docs/**", level: "low" }] } } });

	w.clock.at += w.config.hum.claimExpirySeconds * 1000;
	await lowered.tick();
	await lowered.idle();
	expect(merged(w)).toEqual(["a"]);
	expect(w.shim.calls().filter((c) => c.itemId)).toHaveLength(1);
});

test("the status file lists each path rule the owner's answers added, with the command that takes it back", async () => {
	const w = await world({});

	w.state.learned.put("src/**", { glob: "src/**", level: "low", item: "a", commit: "abc1234", at: NOW });
	await w.worker.tick();

	const status = readStatus(w.state.statusPath);

	expect(status.ok && status.status.rules).toEqual([{ glob: "src/**", level: "low", item: "a", at: NOW, undo: { label: "Undo", command: "git revert abc1234" } }]);
});

test("a path raised while its change's pull request is armed: the next worker disarms it at its first tick, without waiting for the claim and without a run", async () => {
	const github = new FakePulls();
	const pulls = github.client();
	const w = await world({ items: { a: { commitForItem: true, spend: 5 } } }, { worker: { pulls } });

	github.requiresPullRequest = true;
	w.item("a", "docs/a.md");
	await w.worker.tick();
	await w.worker.idle();
	expect(github.pulls).toMatchObject([{ autoMerge: true, state: "OPEN" }]);

	const raised = w.workerWith({ config: { ...w.config, hum: { ...w.config.hum, paths: [{ glob: "docs/**", level: "high" }] } } });

	await raised.tick();
	await raised.idle();
	expect(github.pulls).toMatchObject([{ autoMerge: false, state: "OPEN" }]);
	expect(w.shim.calls().filter((c) => c.itemId)).toHaveLength(1);
});

test("the status file lists the open questions and the newest choices from what the engine saved", async () => {
	const w = await world({}, { settings: { choicesShown: 1 } });

	w.state.questions.put("a@1", { item: "a", text: "Which title?", priority: 0, queuedAt: NOW - 2, askedAt: NOW - 1 });
	w.state.choices.put("b@old", { item: "b", text: "old", at: 3 });
	w.state.choices.put("b@new", { item: "b", text: "new", at: 4 });
	await w.worker.tick();

	const status = readStatus(w.state.statusPath);

	expect(status.ok && status.status.questions).toEqual([{ item: "a", text: "Which title?", options: [], since: NOW - 1 }]);
	expect(status.ok && status.status.choices).toEqual([{ item: "b", text: "new", at: 4 }]);
});

test("memory.md lines with no source or past the byte cap each raise a card naming them, and the cards go once the file is fixed", async () => {
	const w = await world({ items: {} }, { settings: { memoryMaxBytes: 40 } });
	const memoryCards = () => w.state.faults.list().flatMap(({ code, cause }) => (code.startsWith("memory-") ? [{ code, cause }] : []));

	w.ownerFile(".hum/memory.md", "- no source\n- Use plain words (source: owner)\n- Name things for what they do (source: owner)\n");
	await w.workerWith().tick();
	expect(memoryCards()).toEqual([
		{ code: "memory-format", cause: 'Runs skip memory.md line 1: no "(source: …)".' },
		{ code: "memory-full", cause: "Runs skip memory.md line 3: past memoryMaxBytes (40)." },
	]);

	w.ownerFile(".hum/memory.md", "- Use plain words (source: owner)\n");
	await w.workerWith().tick();
	expect(memoryCards()).toEqual([]);
});

test("an item waiting behind a run on the same file starts once the owner moves its touches: elsewhere", async () => {
	const w = await world({ items: { a: { commitForItem: true, spend: 5, sleep: 400 }, b: { commitForItem: true, spend: 5 } } });

	w.item("a", "docs/a.md");
	w.item("b", "docs/a.md");

	expect(await w.worker.tick()).toEqual({ kind: "ran", started: ["a"] });

	w.item("b", "docs/b.md");
	w.clock.at += 1000;
	expect(await w.worker.tick()).toEqual({ kind: "ran", started: ["b"] });
	await w.worker.idle();
});
