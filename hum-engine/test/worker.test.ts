import { expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isAlive, until } from "./fixtures/process.ts";
import { itemFile, markdownSettings, sh } from "./fixtures/work-repo.ts";
import type { Runner } from "../src/adapters/claude-p.ts";
import { finishedOf, succeededWith } from "../src/adapters/hooked-run.ts";
import { readTranscript } from "../src/adapters/transcript.ts";
import { FakeGitHub } from "./fixtures/fake-github.ts";
import { NOW, TTL, workerWorld, type WorkerWorld } from "./fixtures/worker-world.ts";
import { readHeartbeat, readStatus } from "../src/status/file.ts";
import type { ItemLinks } from "../src/status/format.ts";
import { FEEDS_CODE, LINKS_CODE } from "../src/worker/worker.ts";
import { tempDir } from "./fixtures/temp.ts";
import { WAIT_HOURS } from "../src/setup/tables.ts";
import { DAY_MS, HOUR_MS } from "../src/time.ts";
import { scriptedJudge, SOUND } from "./fixtures/judge.ts";
import { type AdapterContext, Holder, ItemId } from "../src/adapter-api.ts";
import { parseArgument } from "../src/adapters/argument.ts";
import { markdownAdapter } from "../src/adapters/markdown.ts";
import { RUN_AGAIN } from "../src/decide/answer.ts";
import { OWNER_APPROVAL } from "../src/decide/merge.ts";
import { isTrusted } from "../src/decide/prose.ts";
import type { Measured, Measurement } from "../src/measure/remeasure.ts";
import { configWith, trustedScores } from "./fixtures/config.ts";
import { type FakeRoundup, fakeRoundup } from "./fixtures/fake-roundup.ts";
import { roundupAdapter } from "../src/adapters/roundup.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";

/** The work order the owner takes in a talk row. */
const WORK_ORDER = { title: "Write the note", ask: "Write docs/a.md.", done: "docs/a.md exists.", limits: ["Change no other file."] };

const merged = (w: WorkerWorld) => w.results.filter((r) => r.outcome === "merged").map((r) => r.item).sort();

/** Ticks until `count` items merged: each push that loses the race to main waits for the next tick, mergeTries of them at most. */
const landsRaced = async (w: WorkerWorld, count: number): Promise<void> => {
	for (let tick = 0; tick < w.config.hum.mergeTries && merged(w).length < count; tick++) {
		await w.worker.tick();
		await w.worker.idle();
	}
};

test("the thin path runs two items on different files side by side, and both merge", async () => {
	const checkLog = join(tempDir("checks"), "log");
	const w = await workerWorld({ items: { a: { writeForItem: true, spend: 5, meet: 2 }, b: { writeForItem: true, spend: 5, meet: 2 } } }, { checks: [`echo run >> ${checkLog}`] });

	w.item("a", "docs/a.md");
	w.item("b", "docs/b.md");

	expect(await w.worker.tick()).toEqual({ kind: "ran", started: ["a", "b"] });
	expect(w.worker.running().sort()).toEqual(["a", "b"]);

	await w.worker.idle();
	await landsRaced(w, 2);

	expect(merged(w)).toEqual(["a", "b"]);
	expect(sh(w.repo.remote, ["show", "main:docs/a.md"])).toBe("from a\n");
	expect(sh(w.repo.remote, ["show", "main:docs/b.md"])).toBe("from b\n");

	expect(readFileSync(checkLog, "utf8").split("\n").filter(Boolean).length).toBeGreaterThanOrEqual(3);
});

test("a tick that claims, runs and merges an item fetches from the remote once", async () => {
	const w = await workerWorld({ items: { a: { writeForItem: true } } });
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
	expect(readFileSync(reads, "utf8").split("\n").filter((command) => /(^|\/)git .* fetch /.test(command))).toHaveLength(1);
});

test("an item whose thread cannot be read raises a card naming it, and the other items still start", async () => {
	const w = await workerWorld({ items: { a: { writeForItem: true } } });

	w.item("a", "docs/a.md");
	w.repo.add("broken", "no item file");
	w.state.parked.put("broken", { item: "broken", why: "stuck", cause: "c", since: NOW });

	expect(await w.worker.tick()).toEqual({ kind: "ran", started: ["a"] });
	expect(w.state.faults.list().map(({ code, item }) => ({ code, item }))).toContainEqual({ code: "item-unread", item: "broken" });

	await w.worker.idle();
});

/** The roundup adapter on `daemon`, as a worker world's work source. */
const roundupOn = (daemon: FakeRoundup) => (context: AdapterContext, clone: string) =>
	roundupAdapter({ socket: daemon.socket, workstream: SHIPPED_DEFAULTS.roundupWorkstream, stateDir: tempDir("roundup-state"), repo: clone, config: SHIPPED_DEFAULTS }, context);

test("a taken Todo the owner deletes ends its item: no card names it and no tick reads it again, and the other item stays as it was", async () => {
	const daemon = await fakeRoundup();
	const hum = daemon.workstream(SHIPPED_DEFAULTS.roundupWorkstream);
	const filed = (name: string) => daemon.todo(name, hum, `touches: docs/${name}.md\n\nDo the work.`);
	const gone = filed("a");
	const kept = filed("b");
	const w = await workerWorld({ items: { [gone]: { writeForItem: true }, [kept]: { writeForItem: true } } }, { checks: ["false"], settings: { maxFixRuns: 1 }, source: roundupOn(daemon) });
	const cardsOf = (item: string) => w.state.faults.list().filter((card) => card.item === item);

	await w.worker.tick();
	await w.worker.idle();

	expect(w.results.map(({ outcome, item }) => ({ outcome, item })).sort((one, other) => (one.item ?? "").localeCompare(other.item ?? ""))).toEqual([
		{ outcome: "stuck", item: gone },
		{ outcome: "stuck", item: kept },
	]);

	const keptBefore = { parked: w.state.parked.get(kept), saved: w.state.items.savedOf(kept), cards: cardsOf(kept) };

	expect(keptBefore.saved).toBeDefined();
	expect(keptBefore.cards).not.toEqual([]);

	daemon.remove(gone);
	w.clock.at += 1000;
	await w.worker.tick();
	await w.worker.idle();

	const reads = daemon.callsOn("todo.get", gone);

	for (let tick = 0; tick < 2; tick++) {
		w.clock.at += TTL + 1;
		await w.worker.tick();
		await w.worker.idle();
	}

	expect(daemon.callsOn("todo.get", gone)).toBe(reads);
	expect(cardsOf(gone)).toEqual([]);
	expect(w.state.faults.list().map(({ code }) => code)).not.toContain("provider-unavailable");
	expect({ parked: w.state.parked.get(gone), saved: w.state.items.savedOf(gone) }).toEqual({ parked: undefined, saved: undefined });
	expect({ parked: w.state.parked.get(kept), saved: w.state.items.savedOf(kept), cards: cardsOf(kept) }).toEqual(keptBefore);
});

test("items that touch one file go one after the other, and an item that says nothing goes alone", async () => {
	const w = await workerWorld({ items: { a: { writeForItem: true, spend: 5 }, b: { writeForItem: true, spend: 5 }, c: { writeForItem: true, spend: 5 } } });

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
	const w = await workerWorld({ items: { a: { writeForItem: true, spend: 5 }, b: { writeForItem: true, spend: 5, sleep: 800 } } }, { checks: ["! (test -f docs/a.md && test -f docs/b.md)"] });

	w.item("a", "docs/a.md");
	w.item("b", "docs/b.md");
	await w.worker.tick();
	await w.worker.idle();
	await w.worker.tick();
	await w.worker.idle();

	expect(merged(w)).toEqual(["a"]);

	const stopped = w.results.findLast((r) => r.item === "b");

	expect(stopped).toMatchObject({ outcome: "review" });
	expect(stopped?.detail).toContain("the checks fail on the newest main");
	expect(() => sh(w.repo.remote, ["show", "main:docs/b.md"])).toThrow();
	expect(w.state.parked.get("b")?.why).toBe("review");
});

test("a run's end while a tick is busy brings the next tick once that tick ends", async () => {
	const w = await workerWorld({}, { settings: { tickIntervalSeconds: 3600 } });
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

test("a worker stopped during a tick starts no pass from that tick, and its serve ends only once the tick has", async () => {
	const w = await workerWorld({ items: { a: { writeForItem: true } } }, { settings: { tickIntervalSeconds: 3600 } });
	const reading = Promise.withResolvers<void>();
	const gate = Promise.withResolvers<void>();
	const source = w.adapter.workSource!;

	w.item("a", "docs/a.md");

	const listReady = async () => {
		reading.resolve();
		await gate.promise;

		return source.listReady();
	};

	const stopped = w.workerWith({ adapters: { workSource: { ...source, listReady }, questions: w.adapter.questions!, answers: w.adapter.answers } });
	const stop = new AbortController();
	const served = stopped.serve(stop.signal);

	await reading.promise;
	stop.abort();
	gate.resolve();

	expect(await served).toEqual({ reason: "stopped" });
	expect(readHeartbeat(w.state.heartbeatPath)?.inFlight).toEqual([]);

	await stopped.idle();

	expect(w.shim.calls().filter((call) => call.itemId)).toEqual([]);
});

test("a new engine in node_modules makes the worker exit within one tick, saying so in its heartbeat and status, which report the engine it runs; an item file does not", async () => {
	const w = await workerWorld({});

	w.ownerFile("node_modules/@moo.md/hum/package.json", JSON.stringify({ version: "0.1.0" }));
	const worker = w.workerWith({ latestVersion: async () => "0.2.0", engineVersion: "0.1.0" });

	expect(await worker.tick()).toEqual({ kind: "ran", started: [] });
	w.ownerFile(".hum/work/new-item.md", "---\ntitle: x\nstate: ready\n---\n");
	expect(await worker.tick()).toEqual({ kind: "ran", started: [] });

	w.ownerFile("node_modules/@moo.md/hum/package.json", JSON.stringify({ version: "0.1.1" }));
	expect(await worker.tick()).toEqual({ kind: "exit", reason: "the engine changed from 0.1.0 to 0.1.1" });

	const beat = readHeartbeat(w.state.heartbeatPath);
	const status = readStatus(w.state.statusPath);

	expect(beat).toMatchObject({ engineVersion: "0.1.0", configHash: w.config.hash, restarting: "the engine changed from 0.1.0 to 0.1.1", inFlight: [] });
	expect(status.ok && status.status.engine).toMatchObject({ version: "0.1.0", latest: "0.2.0" });
});

test("a worker whose repo installs another engine than the one it runs exits at its first tick, as when pnpm moved the link just after the worker loaded", async () => {
	const w = await workerWorld({});

	w.ownerFile("node_modules/@moo.md/hum/package.json", JSON.stringify({ version: "0.1.1" }));

	expect(await w.workerWith({ engineVersion: "0.1.0" }).tick()).toEqual({ kind: "exit", reason: "the engine changed from 0.1.0 to 0.1.1" });
});

test.each([
	[".hum/memory.md", "never touch vendor/\n"],
	["adapters/mine.ts", "export default () => ({})\n"],
	["bun.lock", "{}\n"],
])("an edit to %s makes the worker exit within one tick", async (file, text) => {
	const w = await workerWorld({});
	const worker = w.workerWith();

	w.ownerFile(file, text);
	expect(await worker.tick()).toMatchObject({ kind: "exit" });
});

test("a worker that sees an update starts nothing new, lands nothing and exits when its runs end; the next worker lands the change without a run", async () => {
	const w = await workerWorld({ items: { a: { writeForItem: true, spend: 5, sleep: 400 } } }, { settings: { runners: 1 } });

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
	const w = await workerWorld({ items: { a: { writeForItem: true, spend: 5 }, b: { writeForItem: true, spend: 5 } } }, { settings: { mergedShown: 1 } });

	w.item("a", "docs/a.md");
	w.item("b", "docs/b.md");
	await w.worker.tick();
	await w.worker.idle();
	await landsRaced(w, 2);
	await w.worker.tick();

	const status = readStatus(w.state.statusPath);

	expect(merged(w)).toEqual(["a", "b"]);
	expect(status.ok && status.status.merged).toHaveLength(1);
});

test("a status read that outlasts statusReadTimeoutSeconds shows no value and never holds the tick", async () => {
	const w = await workerWorld({}, { settings: { statusReadTimeoutSeconds: 1 } });
	const worker = w.workerWith({ latestVersion: () => new Promise<never>(() => {}) });
	const began = Date.now();

	await worker.tick();

	const status = readStatus(w.state.statusPath);

	expect(Date.now() - began).toBeLessThan(5000);
	expect(status.ok && status.status.engine.latest).toBeUndefined();
});

test("each tick writes a heartbeat and the status file for the view", async () => {
	const w = await workerWorld({});
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

test("the status file lists each item with a saved state: a waiting one at its wait with the controls it allows, a running one at its run", async () => {
	const w = await workerWorld({ items: { a: { writeForItem: true, askUnlessAnswered: "Which?" }, b: { writeForItem: true, hang: true } } }, { settings: { claimExpirySeconds: 5 } });
	const worker = w.workerWith();

	w.item("a", "docs/a.md");
	await worker.tick();
	await worker.idle();

	const b = w.item("b", "docs/b.md");

	await worker.tick();
	await until(() => w.shim.calls().some((c) => c.itemId === b));
	await worker.tick();

	const status = readStatus(w.state.statusPath);
	const steps = (wait?: string) => ["building", "checking", "fixing", "merging", ...(wait ? [wait] : []), "stuck", "done"].map((name) => ({ name, waitsOnOwner: name === wait }));
	const flowRow = { kind: "docs", flowVersion: w.config.kinds.docs!.machine.version, since: NOW };

	expect(status.ok && status.status.open.toSorted((x, y) => x.item.localeCompare(y.item))).toEqual([
		{ ...flowRow, item: "a", title: "a", steps: steps("asking"), at: "asking", passed: ["building"], running: false, controls: { choices: [], answer: true, skip: false, runNow: true, noteTo: ["building", "checking", "fixing", "merging", "asking", "stuck"] } },
		{ ...flowRow, item: "b", title: "b", steps: steps(), at: "building", passed: [], running: true, controls: { choices: [], answer: false, skip: false, runNow: false, noteTo: ["building", "checking", "fixing", "merging", "stuck"] } },
	]);

	w.clock.at += 10_000;
	await w.adapter.workSource!.claim(b, Holder.parse("worker-2"), 5000);
	await worker.tick();
	await worker.idle();
});

test("where runs are rows, each tick keeps every open item's feed row, and the status file links each open item's rows and handoff Pad and its question's row; a read that fails shows no links and one card until a read goes through", async () => {
	const w = await workerWorld({ items: { a: { writeForItem: true, askUnlessAnswered: "Which?" } } });
	const ask = { name: "hum a ask 1", agent: "4", state: "needs-you", link: "roundup://agent/4?project=key" };
	const linked = { rows: [{ name: "hum a build", agent: "3", state: "done", link: "roundup://agent/3?project=key" }, ask], ask, handoff: { name: "#a handoff", link: "roundup://pad/%23a%20handoff?project=key" } };
	let read = async (): Promise<ReadonlyMap<string, ItemLinks>> => new Map([["a", linked]]);
	const fed: (readonly string[])[] = [];
	const worker = w.workerWith({ runner: { ...(await w.startedRunner()), links: () => read(), keepFeeds: async (items) => void fed.push(items) } });

	const published = async () => {
		w.clock.at += 1000;
		await worker.tick();
		await worker.idle();

		const status = readStatus(w.state.statusPath);

		if (!status.ok) throw new Error(status.message);

		return { open: status.status.open.map(({ item, rows, handoff }) => ({ item, rows, handoff })), questions: status.status.questions.map(({ item, row }) => ({ item, row })), cards: status.status.cards.map(({ code }) => code) };
	};

	w.item("a", "docs/a.md");
	await published();

	expect(await published()).toEqual({ open: [{ item: "a", rows: linked.rows, handoff: linked.handoff }], questions: [{ item: "a", row: ask }], cards: [] });
	expect(fed.at(-1)).toEqual(["a"]);

	read = () => Promise.reject(new Error("roundup is not running"));
	expect(await published()).toEqual({ open: [{ item: "a", rows: undefined, handoff: undefined }], questions: [{ item: "a", row: undefined }], cards: [LINKS_CODE] });

	read = async () => new Map([["a", linked]]);
	expect((await published()).cards).toEqual([]);
});

test("an open item whose feed row the runner could not start raises one card, which a tick that starts it clears", async () => {
	const w = await workerWorld({ items: { a: { writeForItem: true, askUnlessAnswered: "Which?" } } });
	let keep = (): Promise<void> => Promise.reject(new Error("roundup is not running"));
	const worker = w.workerWith({ runner: { ...(await w.startedRunner()), keepFeeds: () => keep() } });

	const cards = async () => {
		w.clock.at += 1000;
		await worker.tick();
		await worker.idle();

		return w.state.faults.list().map(({ code }) => code);
	};

	w.item("a", "docs/a.md");
	await cards();

	expect(await cards()).toEqual([FEEDS_CODE]);

	keep = async () => {};

	expect(await cards()).toEqual([]);
});

test("the claim of a run in flight is renewed each tick, and a run whose claim is gone stops", async () => {
	const w = await workerWorld({ items: { a: { writeForItem: true, spend: 5, hang: true } } }, { settings: { claimExpirySeconds: 5 } });
	const id = w.item("a", "docs/a.md");
	const worker = w.workerWith();

	await worker.tick();

	await until(() => w.shim.calls().some((c) => c.itemId === id));

	// 3 s on: a tick renews to 8 s. At 6 s the first expiry has passed, yet nobody else can take it.
	w.clock.at += 3000;
	await worker.tick();
	w.clock.at += 3000;
	expect((await w.adapter.workSource!.claim(id, Holder.parse("worker-2"), 5000)).won).toBe(false);

	// 10 s on, with no renewal: worker-2 takes it, the next tick finds the claim gone and stops the run.
	w.clock.at += 4000;
	expect((await w.adapter.workSource!.claim(id, Holder.parse("worker-2"), 5000)).won).toBe(true);

	const pid = w.shim.calls().find((c) => c.itemId === id)!.pid;

	await worker.tick();
	await worker.idle();

	expect(w.results.find((r) => r.item === id)).toMatchObject({ outcome: "lost" });
	await until(() => !isAlive(pid));
});

test("an item id in the inbox folder wakes a waiting item at once and its question leaves the status file", async () => {
	const answersAdapter = (real: NonNullable<WorkerWorld["adapter"]["answers"]>) => ({ ...real, watch: async () => ({ token: "same", changed: false }) });
	const w = await workerWorld({ items: { a: { writeForItem: true, askUnlessAnswered: "Which?" } } });

	w.item("a", "docs/a.md");

	const worker = w.workerWith({ adapters: { workSource: w.adapter.workSource!, questions: w.adapter.questions!, answers: answersAdapter(w.adapter.answers!) } });

	await worker.tick();
	await worker.idle();
	expect(w.results.at(-1)).toMatchObject({ outcome: "asked", item: "a" });

	await w.adapter.answers!.answer(ItemId.parse("a"), { text: "Use Plain" });
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
	expect(w.state.events.list("a").map((e) => e.type)).toContain("answered");
});

test("an item that waits on the owner in a talk row holds no runner: another item builds meanwhile, and once the row's answer counts the waiting item runs again and takes it", async () => {
	const w = await workerWorld({ items: { b: { writeForItem: true } } }, { settings: { runners: 1 } });
	const real = w.thinPath().runner;
	const talked: string[] = [];
	let answered = false;

	const runner: Runner = {
		...real,
		talks: true,
		talking: async () => new Map([["a", !answered]]),
		run: async (request) => {
			if (request.talk !== true) return real.run(request);

			talked.push(request.name ?? "");

			return answered && request.name?.includes(" ideate ") ? finishedOf(undefined, readTranscript(""), succeededWith({ order: WORK_ORDER })) : { kind: "waiting" };
		},
	};

	const worker = w.workerWith({ runner, talkCopy: async () => ({ folder: tempDir("talk"), env: {} }) });

	w.repo.add("a", itemFile("a", { body: "kind: feature\ntouches: docs/a.md\n\nWrite the note." }));
	w.item("b", "docs/b.md");

	expect(await worker.tick()).toEqual({ kind: "ran", started: ["a"] });
	await worker.idle();
	expect(w.results).toEqual([{ outcome: "waiting", item: "a" }]);

	expect(await worker.tick()).toEqual({ kind: "ran", started: ["b"] });
	await worker.idle();
	expect(merged(w)).toEqual(["b"]);

	answered = true;

	expect(await worker.tick()).toEqual({ kind: "ran", started: ["a"] });
	await worker.idle();
	expect(w.results.at(-1)).toEqual({ outcome: "waiting", item: "a" });
	expect(w.state.talks.get("a")?.order).toEqual(WORK_ORDER);

	const [ideate, again, next] = talked;

	expect(again).toBe(ideate);
	expect(next).toContain(" shape ");
});

test("a saved deadline fires on the next event, not only on a tick: a question the owner never answers ends stuck", async () => {
	const w = await workerWorld({ items: { a: { writeForItem: true, askUnlessAnswered: "Which?" } } }, { worker: { ciTick: async () => NOW } });

	w.item("a", "docs/a.md");
	await w.worker.tick();
	await w.worker.idle();
	expect(w.results.at(-1)).toMatchObject({ outcome: "asked" });

	const calls = w.shim.calls().length;

	const pastTheWait = WAIT_HOURS.owner * HOUR_MS + 1;

	w.clock.at += pastTheWait;
	await w.worker.tick();

	expect(w.state.parked.get("a")).toMatchObject({ why: "stuck" });
	expect(w.state.faults.list().map((c) => c.code)).toContain("item-stuck");
	expect(w.shim.calls()).toHaveLength(calls);

	const status = readStatus(w.state.statusPath);

	expect(status.ok && w.clock.at - (status.status.workers.ci ?? 0)).toBe(pastTheWait);
});

test("an item in an owner wait whose timeout goes on to work sleeps through it, and once it passes the next tick restores the wait and goes on", async () => {
	const repro = { write: { "docs/repro.sh": "grep -q fixed docs/note.md\n" }, structured: { status: "done", repro: { command: "sh docs/repro.sh" } } };
	const w = await workerWorld({ script: [{}, repro, { write: { "docs/note.md": "fixed\n" } }] }, { worker: { judge: scriptedJudge({ kind: { kind: "fix" }, alignment: SOUND }) } });

	w.item("a", "docs/note.md");
	await w.worker.tick();
	await w.worker.idle();
	expect(w.results.at(-1)).toMatchObject({ outcome: "asked", item: "a" });

	w.clock.at += HOUR_MS;
	await w.worker.tick();
	await w.worker.idle();
	expect(w.shim.calls()).toHaveLength(2);

	w.clock.at += DAY_MS;
	await w.worker.tick();
	await w.worker.idle();
	expect(w.results.at(-1)).toMatchObject({ outcome: "merged", item: "a" });
	expect(w.shim.calls()).toHaveLength(3);
});

test("the owner's run now fires the timer of the wait an item is at though the daily cap still holds its question, which it drops", async () => {
	const repro = { write: { "docs/repro.sh": "grep -q fixed docs/note.md\n" }, structured: { status: "done", repro: { command: "sh docs/repro.sh" } } };
	const w = await workerWorld({ script: [{}, repro, { write: { "docs/note.md": "fixed\n" } }] }, { worker: { judge: scriptedJudge({ kind: { kind: "fix" }, alignment: SOUND }) }, settings: { dailyQuestionCap: 1 } });
	const held = () => w.state.questions.list().filter(({ item, askedAt }) => item === "a" && askedAt === undefined);

	w.state.questions.put("other@0", { item: "other", text: "Asked earlier today?", priority: 0, queuedAt: NOW, askedAt: NOW });
	w.item("a", "docs/note.md");
	await w.worker.tick();
	await w.worker.idle();
	expect(w.state.items.savedOf("a")?.state).toBe("objecting");
	expect(held()).toHaveLength(1);

	await w.adapter.answers!.request(ItemId.parse("a"), { kind: "run-now", step: "objecting" });
	await w.worker.tick();
	await w.worker.idle();

	expect(w.results.at(-1)).toMatchObject({ outcome: "merged", item: "a" });
	expect(w.shim.calls()).toHaveLength(3);
	expect(held()).toEqual([]);
	expect((await w.adapter.workSource!.read(ItemId.parse("a"))).thread.map(({ text }) => text)).toContain("Request 1 applied: the timer of objecting fires now.");
});

test("the owner's skip takes a wait its kind file lets them skip where the skip leads, and a request at a step the item is not at is refused on the thread", async () => {
	const config = configWith((raw) => void (raw.kinds.docs.machine.states.asking.meta.skip = { target: "checking" }));
	const w = await workerWorld({ items: { a: { writeForItem: true, askUnlessAnswered: "Which?" } } }, { config });
	const a = ItemId.parse("a");

	w.item("a", "docs/a.md");
	await w.worker.tick();
	await w.worker.idle();
	expect(w.state.items.savedOf("a")?.state).toBe("asking");

	await w.adapter.answers!.request(a, { kind: "skip", step: "building" });
	await w.adapter.answers!.request(a, { kind: "skip", step: "asking" });
	await w.worker.tick();
	await w.worker.idle();

	expect(w.results.at(-1)).toMatchObject({ outcome: "merged", item: "a" });
	expect(w.shim.calls().filter(({ itemId }) => itemId === "a")).toHaveLength(1);
	expect((await w.adapter.workSource!.read(a)).thread.map(({ text }) => text)).toEqual(
		expect.arrayContaining(["Request 1 refused: the item is at asking now, not building.", "Request 2 applied: the item leaves asking where its kind file's skip leads."]),
	);
});

test("an item someone else claims never starts and carries a card naming them, which goes once they let it go", async () => {
	const w = await workerWorld({ items: { a: { writeForItem: true } } });
	const claimedBy: string[] = ["@ana"];
	const source = w.adapter.workSource!;
	const worker = w.workerWith({ adapters: { workSource: { ...source, read: async (id: ItemId) => ({ ...(await source.read(id)), claimedBy }) }, questions: w.adapter.questions!, answers: w.adapter.answers } });

	w.item("a", "docs/a.md");
	await worker.tick();
	await worker.idle();
	expect(w.results).toEqual([]);
	expect(w.state.faults.list().find(({ code }) => code === "item-claimed")?.cause).toBe("a is already taken by @ana, so hum starts no rival change.");

	claimedBy.pop();
	await worker.tick();
	await worker.idle();
	expect(w.results).toMatchObject([{ outcome: "merged", item: "a" }]);
	expect(w.state.faults.list().map(({ code }) => code)).not.toContain("item-claimed");
});

test("an item hum started goes on though another pull request closes it, and a claim card it carried from before goes", async () => {
	const w = await workerWorld({ items: { a: { writeForItem: true } } });
	const source = w.adapter.workSource!;
	const worker = w.workerWith({ adapters: { workSource: { ...source, read: async (id: ItemId) => ({ ...(await source.read(id)), claimedBy: ["pull request #7"] }) }, questions: w.adapter.questions!, answers: w.adapter.answers } });

	w.item("a", "docs/a.md");
	w.state.itemKinds.put("a", { item: "a", kind: "docs", from: "source" });
	w.state.items.save("a", w.config.kinds.docs!, { status: "active", value: "building", context: {} });
	w.state.faults.raise({ code: "item-claimed", item: "a", cause: "a is already taken by pull request #7, so hum starts no rival change.", fix: "Close the pull request." });

	expect(await worker.tick()).toEqual({ kind: "ran", started: ["a"] });
	expect(w.state.faults.list().map(({ code }) => code)).not.toContain("item-claimed");

	await worker.idle();
});

test("a fix item run again after its window passed reruns the repro, and opens the window again only when the repro changed", async () => {
	const repro = (command: string) => ({ write: { "docs/repro.sh": "grep -q fixed docs/note.md\n" }, structured: { status: "done", repro: { command } } });

	const runAgainAfterTheWindow = async (again: ReturnType<typeof repro>) => {
		const w = await workerWorld({ script: [{}, repro("sh docs/repro.sh"), { error: "the run broke" }, again, { write: { "docs/note.md": "fixed\n" } }] }, { worker: { judge: scriptedJudge({ kind: { kind: "fix" }, alignment: SOUND }) } });

		const step = async () => {
			await w.worker.tick();
			await w.worker.idle();
		};

		w.item("a", "docs/note.md");
		await step();
		expect(w.results.at(-1)).toMatchObject({ outcome: "asked", item: "a" });

		w.clock.at += DAY_MS + 1;
		await step();
		expect(w.results.at(-1)).toMatchObject({ outcome: "stuck", item: "a" });

		w.clock.at += TTL + 1;
		await w.adapter.answers!.answer(ItemId.parse("a"), { text: "retry" });
		await step();

		return { result: w.results.at(-1), runs: w.shim.calls().length };
	};

	expect(await runAgainAfterTheWindow(repro("sh docs/repro.sh"))).toMatchObject({ result: { outcome: "merged", item: "a" }, runs: 5 });
	expect(await runAgainAfterTheWindow(repro("bash docs/repro.sh"))).toMatchObject({ result: { outcome: "asked", item: "a" }, runs: 4 });
});

test("the owner's stop at the token cap ends the item, and Run it again starts it afresh", async () => {
	const config = configWith((raw) => {
		raw.kinds.docs.tokenCap.tokens = 500;
	});

	const w = await workerWorld({ script: [{}, { write: { "docs/a.md": "long\n" }, modelTokens: 1000 }, { write: { "docs/a.md": "short\n" }, modelTokens: 1 }] }, { config });

	const step = async (answer?: string) => {
		w.clock.at += TTL + 1;

		if (answer !== undefined) await w.adapter.answers!.answer(ItemId.parse("a"), { text: answer });

		await w.worker.tick();
		await w.worker.idle();

		return w.results.at(-1);
	};

	w.item("a", "docs/a.md");
	expect(await step()).toMatchObject({ outcome: "asked", item: "a" });
	expect(await step("Stop.")).toMatchObject({ outcome: "stuck", item: "a", detail: "the owner stopped it at the token cap" });
	await step("retry");
	expect(w.state.parked.get("a")).toBeUndefined();
	expect(await step()).toMatchObject({ outcome: "merged", item: "a" });
});

test("a stuck item never reruns until the owner answers; the answer takes it back with a fresh token cap", async () => {
	const flag = join(tempDir("flag"), "flag");
	const w = await workerWorld({ items: { a: { writeForItem: true, modelTokens: 400 } } }, { checks: [`test -f ${flag}`], settings: { maxFixRuns: 1 } });

	w.item("a", "docs/a.md");
	await w.worker.tick();
	await w.worker.idle();

	expect(w.results.at(-1)).toMatchObject({ outcome: "stuck", item: "a" });

	const spent = w.shim.calls().length;

	expect(w.state.parked.get("a")).toMatchObject({ why: "stuck" });
	expect(w.state.spent.get("a")).toMatchObject({ total: 401, base: 0 });

	// The file still says ready and the claim lapses, yet no tick spends tokens on it.
	for (let tick = 0; tick < 3; tick++) {
		w.clock.at += TTL + 1;
		expect(await w.worker.tick()).toEqual({ kind: "ran", started: [] });
	}

	expect(w.shim.calls()).toHaveLength(spent);
	expect(w.state.questions.list()).toEqual([]);

	writeFileSync(flag, "");
	w.clock.at += 1000;
	await w.adapter.answers!.answer(ItemId.parse("a"), { text: "retry" });
	await w.worker.tick();
	await w.worker.idle();

	expect(w.results.at(-1)).toMatchObject({ outcome: "merged", item: "a" });
	expect(w.state.parked.get("a")).toBeUndefined();
	expect(w.state.faults.list().map((c) => c.code)).not.toContain("item-stuck");
	expect(w.state.spent.get("a")).toMatchObject({ total: 802, base: 401 });
});

/** A markdown source whose owner answers only a question hum asked, as on roundup. */
const answersOnlyToQuestions = (context: AdapterContext, repo: string) => {
	const markdown = markdownAdapter({ ...markdownSettings, repo }, context);

	return { ...markdown, answers: markdown.answers && { ...markdown.answers, onlyToQuestions: true as const } };
};

test("where the owner answers only a question, a stuck item asks once to run again, and the answer to it runs the item again", async () => {
	const flag = join(tempDir("flag"), "flag");

	const w = await workerWorld({ items: { a: { writeForItem: true } } }, { checks: [`test -f ${flag}`], settings: { maxFixRuns: 1 }, source: answersOnlyToQuestions });

	w.item("a", "docs/a.md");
	await w.worker.tick();
	await w.worker.idle();

	expect(w.results.at(-1)).toMatchObject({ outcome: "stuck", item: "a" });

	for (let tick = 0; tick < 3; tick++) {
		w.clock.at += TTL + 1;
		await w.worker.tick();
	}

	const asked = () => w.state.questions.list().map(({ item, options, askedAt }) => ({ item, options, asked: askedAt !== undefined }));

	expect(asked()).toEqual([{ item: "a", options: [RUN_AGAIN], asked: true }]);

	const runAgain = async (text: string) => {
		w.clock.at += 1000;
		await w.adapter.answers!.answer(ItemId.parse("a"), { text, option: RUN_AGAIN });
		await w.worker.tick();
		await w.worker.idle();
	};

	await runAgain("run it again");

	expect(w.results.at(-1)).toMatchObject({ outcome: "stuck", item: "a" });

	w.clock.at += TTL + 1;
	await w.worker.tick();

	expect(asked()).toEqual([
		{ item: "a", options: [RUN_AGAIN], asked: true },
		{ item: "a", options: [RUN_AGAIN], asked: true },
	]);

	writeFileSync(flag, "");
	await runAgain("once more");

	expect(w.results.at(-1)).toMatchObject({ outcome: "merged", item: "a" });
});

test("in a CI wake, where no card reaches the owner, a stuck item asks on its thread to run again, and the answer runs it again", async () => {
	const flag = join(tempDir("flag"), "flag");
	const w = await workerWorld({ items: { a: { writeForItem: true } } }, { checks: [`test -f ${flag}`], settings: { maxFixRuns: 1 }, worker: { where: "ci" } });

	w.item("a", "docs/a.md");
	await w.worker.tick();
	await w.worker.idle();

	expect(w.results.at(-1)).toMatchObject({ outcome: "stuck", item: "a" });

	w.clock.at += TTL + 1;
	await w.worker.tick();

	expect(w.state.questions.list().map(({ item, options, askedAt }) => ({ item, options, asked: askedAt !== undefined }))).toEqual([{ item: "a", options: [RUN_AGAIN], asked: true }]);

	writeFileSync(flag, "");
	w.clock.at += 1000;
	await w.adapter.answers!.answer(ItemId.parse("a"), { text: "retry" });
	await w.worker.tick();
	await w.worker.idle();

	expect(w.results.at(-1)).toMatchObject({ outcome: "merged", item: "a" });
});

test.each([
	["picked", { text: "approve", option: OWNER_APPROVAL }],
	["typed", { text: "approve" }],
] as const)("where the owner answers only a question, an item waiting on review asks to approve or run again, and approve, %s, lands it with no second run", async (_, approval) => {
	const w = await workerWorld({ items: { a: { writeForItem: true } } }, { settings: { paths: [{ glob: "docs/**", level: "high" }] }, source: answersOnlyToQuestions });

	w.item("a", "docs/a.md");
	await w.worker.tick();
	await w.worker.idle();

	expect(w.results).toMatchObject([{ outcome: "review", item: "a" }]);

	w.clock.at += 1000;
	await w.worker.tick();

	expect(w.state.questions.list().map(({ item, options, askedAt }) => ({ item, options, asked: askedAt !== undefined }))).toEqual([{ item: "a", options: [OWNER_APPROVAL, RUN_AGAIN], asked: true }]);

	w.clock.at += TTL + 1;
	await w.adapter.answers!.answer(ItemId.parse("a"), approval);
	await w.worker.tick();
	await w.worker.idle();

	expect(merged(w)).toEqual(["a"]);
	expect(w.shim.calls().filter((call) => call.itemId)).toHaveLength(1);
});

test("an item the owner runs again after it ended stuck at the fix cap gets its fix runs afresh", async () => {
	const w = await workerWorld({ items: { a: { writeForItem: true } } }, { checks: ["! test -f docs/a.md"], settings: { maxFixRuns: 1 } });

	const pass = async () => {
		const before = w.shim.calls().length;

		await w.worker.tick();
		await w.worker.idle();

		return { result: w.results.at(-1), runs: w.shim.calls().length - before };
	};

	const stuckAfterOneFix = { result: { outcome: "stuck", item: "a", detail: "the checks still fail after 1 fixes" }, runs: 2 };

	w.item("a", "docs/a.md");
	expect(await pass()).toMatchObject(stuckAfterOneFix);

	w.clock.at += TTL + 1;
	await w.adapter.answers!.answer(ItemId.parse("a"), { text: "retry" });

	expect(await pass()).toMatchObject(stuckAfterOneFix);
});

test("a limit the runner hit is saved, and a restarted worker makes no call before it ends, then resumes", async () => {
	const until = Math.floor(NOW / 1000) + 3600;
	const w = await workerWorld({ items: { a: { error: `Claude usage limit reached|${until}` } } });

	w.item("a", "docs/a.md");
	await w.worker.tick();
	await w.worker.idle();

	expect(w.results.at(-1)).toMatchObject({ outcome: "limited", until: until * 1000 });
	expect(w.state.limit.get("runner")).toEqual({ until: until * 1000 });

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
	const w = await workerWorld({ items: { a: { writeForItem: true, spend: 5 } } }, { settings: { paths: [{ glob: "docs/**", level: "high" }] } });

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
	const w = await workerWorld({});

	w.state.learned.put("src/**", { glob: "src/**", level: "low", item: "a", commit: "abc1234", at: NOW });
	await w.worker.tick();

	const status = readStatus(w.state.statusPath);

	expect(status.ok && status.status.rules).toEqual([{ glob: "src/**", level: "low", item: "a", at: NOW, undo: { label: "Undo", command: "git revert abc1234" } }]);
});

test("a path raised while its change's pull request is armed: the next worker disarms it at its first tick, without waiting for the claim and without a run", async () => {
	const github = new FakeGitHub();
	const pulls = github.client();
	const w = await workerWorld({ items: { a: { writeForItem: true, spend: 5 } } }, { worker: { pulls } });

	github.requiresPullRequest = true;
	w.item("a", "docs/a.md");
	await w.worker.tick();
	await w.worker.idle();
	expect(github.pulls()).toMatchObject([{ autoMerge: true, state: "OPEN" }]);

	const raised = w.workerWith({ config: { ...w.config, hum: { ...w.config.hum, paths: [{ glob: "docs/**", level: "high" }] } } });

	await raised.tick();
	await raised.idle();
	expect(github.pulls()).toMatchObject([{ autoMerge: false, state: "OPEN" }]);
	expect(w.shim.calls().filter((c) => c.itemId)).toHaveLength(1);
});

test("the status file lists the open questions and the newest choices from what the engine saved", async () => {
	const w = await workerWorld({}, { settings: { choicesShown: 1 } });

	for (const id of ["a", "b"]) w.repo.add(id, itemFile(id, { state: "done" }));

	w.state.questions.put("a@1", { item: "a", text: "Which title?", priority: 0, queuedAt: NOW - 2, askedAt: NOW - 1 });
	w.state.choices.put("b@old", { item: "b", text: "old", at: 3 });
	w.state.choices.put("b@new", { item: "b", text: "new", at: 4 });
	w.state.parked.put("b", { item: "b", why: "stuck", cause: "the checks still fail", since: 5 });
	await w.worker.tick();

	const status = readStatus(w.state.statusPath);

	expect(status.ok && status.status.questions).toEqual([{ item: "a", text: "Which title?", options: [], since: NOW - 1 }]);
	expect(status.ok && status.status.choices).toEqual([{ item: "b", text: "new", at: 4, result: "stuck" }]);
});

test("memory.md lines with no source or past the byte cap each raise a card naming them, and the cards go once the file is fixed", async () => {
	const w = await workerWorld({ items: {} }, { settings: { memoryMaxBytes: 40 } });
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

test("a split part waits for the part it names to merge, though their files differ, and its own check, which no base was meant to pass, goes to fix runs when it fails", async () => {
	const w = await workerWorld({ items: { a: { writeForItem: true, spend: 5 }, b: { writeForItem: true, spend: 5 } } }, { checks: ["true"], settings: { maxFixRuns: 1 } });

	w.item("a", "docs/a.md");
	w.item("b", "docs/b.md");
	w.state.parts.put("a", { item: "a", from: "x", waitsOn: [], check: "test -f docs/a.md" });
	w.state.parts.put("b", { item: "b", from: "x", waitsOn: ["a"], check: "test -f docs/never.md" });

	expect(await w.worker.tick()).toEqual({ kind: "ran", started: ["a"] });
	await w.worker.idle();
	expect(w.results).toMatchObject([{ outcome: "merged", item: "a" }]);

	expect(await w.worker.tick()).toEqual({ kind: "ran", started: ["b"] });
	await w.worker.idle();
	expect(w.results.at(-1)).toMatchObject({ outcome: "stuck", item: "b", detail: "the checks still fail after 1 fixes" });
});

test("an item waiting behind a run on the same file starts once the owner moves its touches: elsewhere", async () => {
	const w = await workerWorld({ items: { a: { writeForItem: true, spend: 5, sleep: 400 }, b: { writeForItem: true, spend: 5 } } });

	w.item("a", "docs/a.md");
	w.item("b", "docs/a.md");

	expect(await w.worker.tick()).toEqual({ kind: "ran", started: ["a"] });

	w.item("b", "docs/b.md");
	w.clock.at += 1000;
	expect(await w.worker.tick()).toEqual({ kind: "ran", started: ["b"] });
	await w.worker.idle();
});

test("two items with no touches: line start together where the owner lets such items run side by side", async () => {
	const w = await workerWorld({ items: { a: { writeForItem: true, spend: 5, sleep: 400 }, b: { writeForItem: true, spend: 5 } } }, { settings: { undeclaredRunsAlone: false } });

	w.item("a");
	w.item("b");

	expect(await w.worker.tick()).toEqual({ kind: "ran", started: ["a", "b"] });
	await w.worker.idle();
});

test("two items with no touches: line that change the same file run side by side, and the one that lands second is built again on the first and lands, with no owner", async () => {
	const note = (text: string) => ({ write: { "docs/note.md": text }, spend: 5, sleep: 300 });
	const w = await workerWorld({ items: { a: note("from a\n"), b: note("from b\n") } }, { settings: { runners: 2, undeclaredRunsAlone: false, conflictRebuilds: 1 } });

	w.item("a");
	w.item("b");

	expect(await w.worker.tick()).toEqual({ kind: "ran", started: ["a", "b"] });

	for (let tick = 0; tick < 4 && w.results.filter(({ outcome }) => outcome === "merged").length < 2; tick++) {
		await w.worker.idle();
		w.clock.at += 1000;
		await w.worker.tick();
	}

	await w.worker.idle();
	expect(w.results.map(({ outcome }) => outcome).toSorted()).toEqual(["held", "merged", "merged", "restarted"]);
	expect(w.state.faults.list()).toEqual([]);
	expect(w.state.questions.list()).toEqual([]);
});

test("a review-note loop pass that succeeds clears the card an earlier failed pass left, so a CI wake that restores that card no longer stops on it", async () => {
	const w = await workerWorld({ items: {} });

	w.state.faults.raise({ code: "review-loop", cause: "The review-note loop failed: ✖ a GitHub issue number is a whole number above 0", fix: "It runs again next interval; look at the cause if this card stays." });

	await w.worker.tick();
	await w.worker.idle();

	expect(w.state.faults.list()).toEqual([]);
});

test("a question release that succeeds clears the card an earlier failed release left, so a CI wake that restores that card no longer stops on it", async () => {
	const w = await workerWorld({ items: {} });

	w.state.faults.raise({ code: "question-release", cause: "Queued questions could not be asked: 502 Bad Gateway", fix: "hum asks them again on the next tick." });

	await w.worker.tick();
	await w.worker.idle();

	expect(w.state.faults.list()).toEqual([]);
});

test("an item's pass that ends clears the run-error card an earlier failed pass left for that item, and only that item's", async () => {
	const w = await workerWorld({ items: { a: { writeForItem: true } } });

	for (const item of ["a", "b"]) w.state.faults.raise({ code: "run-error", item, cause: `The run for ${item} failed: spawn claude ENOENT`, fix: "hum tries the item again when its claim lapses; look at the cause if this card stays." });
	w.item("a", "docs/a.md");

	await w.worker.tick();
	await w.worker.idle();

	expect(merged(w)).toEqual(["a"]);
	expect(w.state.faults.list().map(({ code, item }) => ({ code, item }))).toEqual([{ code: "run-error", item: "b" }]);
});

test("a review-note loop pass that fails raises a card naming the step it failed in and the value it refused", async () => {
	const issueNumber = ItemId.refine((id) => /^[1-9]\d*$/.test(id), "a GitHub issue number is a whole number above 0");

	const comments = async () => {
		parseArgument(issueNumber, "rn-1a2b");

		return [];
	};

	const w = await workerWorld({ items: {} }, { worker: { loop: { comments } } });

	await w.worker.tick();
	await w.worker.idle();

	expect(w.state.faults.list().map(({ code, cause }) => ({ code, cause }))).toEqual([{ code: "review-loop", cause: 'The review-note loop failed: read and pair review notes: "rn-1a2b": ✖ a GitHub issue number is a whole number above 0' }]);
});

/** The shipped config whose review role changed after its scores were measured. */
const reviewRoleChanged = (measuredAgain = false) =>
	configWith((raw) => {
		raw.roles["roles/review.md"] = `${raw.roles["roles/review.md"]}\nCite each line you judge.`;

		if (measuredAgain) raw.hum.measuredModels = trustedScores(raw);
	});

const judgeCards = (w: WorkerWorld) => w.state.faults.list().flatMap(({ code, cause }) => (code === "judge-changed" ? [cause] : []));

test("where hum cannot keep a measurement, a judge whose text changed gates on its old score under a card naming it, and the card goes once a score on the new text replaces it", async () => {
	const config = reviewRoleChanged();
	const w = await workerWorld({ items: {} }, { config });

	await w.worker.tick();

	const { light, standard, top } = config.hum.models;

	expect(judgeCards(w)).toEqual([`review-verdict on ${light} at 1.00, review-verdict on ${standard} at 1.00, review-verdict on ${top} at 1.00 gate on rates measured before the judge's prompt or role text last changed.`]);
	expect(isTrusted([light], "review-verdict", config.hum)).toBe(true);

	await w.workerWith({ config: reviewRoleChanged(true) }).tick();

	expect(judgeCards(w)).toEqual([]);
});

test("where hum can keep a measurement, it measures each model once at the boundaries whose judge changed, names a failed one on the card, and tries again after the loop interval", async () => {
	const config = reviewRoleChanged();
	const { light, standard, top } = config.hum.models;
	const asked: Measurement[] = [];
	const remeasure = async (measurement: Measurement): Promise<Measured> => (asked.push(measurement), measurement.model === top ? { ok: false, why: "a usage limit refused the call" } : { ok: true });
	const w = await workerWorld({ items: {} }, { config, worker: { remeasure } });

	const tickAt = async (at: number) => {
		w.clock.at = at;
		await w.worker.tick();
		await w.worker.idle();
	};

	await tickAt(NOW);

	expect(asked).toEqual([light, standard, top].map((model) => ({ model, boundaries: ["review-verdict"], runs: config.hum.evalRuns })));
	expect(judgeCards(w)).toEqual([expect.stringContaining(`Measuring them again failed: ${top}: a usage limit refused the call`)]);

	await tickAt(NOW + config.hum.loopIntervalSeconds * 1000 - 1);
	expect(asked).toHaveLength(3);

	await tickAt(NOW + config.hum.loopIntervalSeconds * 1000);
	expect(asked).toHaveLength(6);
});

test("results a measurement writes under .hum/evals leave the worker serving, and a worker that sees new scores in hum.json exits only once the measurement ends", async () => {
	const ended = Promise.withResolvers<Measured>();
	const w = await workerWorld({ items: {} }, { config: reviewRoleChanged(), worker: { remeasure: () => ended.promise } });

	await w.worker.tick();
	w.ownerFile(".hum/evals/review-verdict/RESULTS.md", "| 2026-11-17 | claude-haiku-5-5 | 12 |\n");
	expect((await w.worker.tick()).kind).toBe("ran");

	w.ownerFile(".hum/hum.json", "{}");
	expect((await w.worker.tick()).kind).toBe("draining");

	ended.resolve({ ok: true });
	await w.worker.idle();
	expect((await w.worker.tick()).kind).toBe("exit");
});

test("a worker told to stop stops the measurement it runs", async () => {
	const measuring = Promise.withResolvers<AbortSignal>();
	const remeasure = (_: Measurement, signal: AbortSignal) => (measuring.resolve(signal), new Promise<Measured>((resolve) => signal.addEventListener("abort", () => resolve({ ok: false, why: "stopped" }))));
	const w = await workerWorld({ items: {} }, { config: reviewRoleChanged(), worker: { remeasure } });
	const stop = new AbortController();
	const served = w.worker.serve(stop.signal);
	const signal = await measuring.promise;

	stop.abort();

	expect(await served).toEqual({ reason: "stopped" });
	expect(signal.aborted).toBe(true);
});
