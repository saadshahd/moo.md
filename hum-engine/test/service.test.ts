import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CI_TICK_REF, readCiTick, recordCiTick } from "../src/service/ci-tick.ts";
import { type Child, EXIT_UPDATED, supervise, type Supervision } from "../src/service/supervise.ts";
import { checkTokenAge } from "../src/service/token.ts";
import { wakeUntilQuiet } from "../src/service/wake.ts";
import { openState } from "../src/state/open.ts";
import { readStatus, writeHeartbeat } from "../src/status/file.ts";
import { configWith } from "./fixtures/config.ts";
import { sh, WorkRepo } from "./fixtures/work-repo.ts";
import { NOW, TTL, workerWorld, type WorkerWorld } from "./fixtures/worker-world.ts";

const DAY = 86_400_000;
const TICK = 30_000;

const cleanups: (() => void)[] = [];

afterEach(() => {
	for (const clean of cleanups.splice(0)) clean();
});

const worlds: WorkerWorld[] = [];

const world = async (...args: Parameters<typeof workerWorld>) => {
	const w = await workerWorld(...args);

	worlds.push(w);
	cleanups.push(w.clean);

	return w;
};

/** The service unit's start script on a clock that moves only when it sleeps, over a state folder in a temp dir. */
const unit = (over: Partial<Supervision> & { spawn: () => Child }) => {
	const clock = { at: NOW };
	const now = () => clock.at;
	const state = openState(mkdtempSync(join(tmpdir(), "hum-unit-")), { now });
	const stop = new AbortController();

	cleanups.push(() => rmSync(state.dir, { recursive: true, force: true }));

	const supervision: Supervision = {
		state,
		now,
		sleep: (ms, cancel) =>
			new Promise((resolve) =>
				setTimeout(() => {
					if (!cancel.aborted) clock.at += ms;

					resolve();
				}, 0),
			),
		intervalMs: TICK,
		maxCrashes: 5,
		crashWindowMs: 10 * 60_000,
		backoffMs: 1000,
		stop: stop.signal,
		...over,
	};

	const cardsInStatus = () => {
		const read = readStatus(state.statusPath);

		if (!read.ok) throw new Error(read.message);

		return read.status.cards;
	};

	return { clock, state, stop, run: () => supervise(supervision), cardsInStatus };
};

const exited = (code: number): Child => ({ exited: Promise.resolve(code), kill: () => {} });

/** A worker that never exits until it is told to. */
const hangs = (): Child => {
	const ended = Promise.withResolvers<number>();

	return { exited: ended.promise, kill: () => ended.resolve(0) };
};

test("a worker that exits at start is restarted N times, then one card shows and the script stops with exit 0", async () => {
	let spawns = 0;
	const u = unit({ spawn: () => (spawns++, exited(1)) });

	expect(await u.run()).toBe("gave-up");
	expect(spawns).toBe(5);
	// The card is in the file the view reads and in the faults folder, within three ticks of the first start.
	expect(u.cardsInStatus()).toHaveLength(1);
	expect(u.cardsInStatus()[0]).toMatchObject({ code: "worker-down" });
	expect(u.cardsInStatus()[0]?.cause).toContain("Restarts have stopped");
	expect(readdirSync(join(u.state.dir, "faults"))).toHaveLength(1);
	expect(u.clock.at - NOW).toBeLessThan(3 * TICK);
});

test("crashes spread over more than the window do not stop the restarts", async () => {
	let spawns = 0;

	const u = unit({
		spawn: () => {
			spawns++;
			u.clock.at += 11 * 60_000;

			if (spawns === 8) u.stop.abort();

			return exited(1);
		},
	});

	expect(await u.run()).toBe("stopped");
	expect(spawns).toBe(8);
	expect(u.cardsInStatus().map((c) => c.cause).join()).not.toContain("Restarts have stopped");
});

test("a worker that exits to take an update is started again and never counts as a crash", async () => {
	let spawns = 0;
	const u = unit({ spawn: () => (spawns++ === 9 ? (u.stop.abort(), exited(0)) : exited(EXIT_UPDATED)) });

	expect(await u.run()).toBe("stopped");
	expect(spawns).toBe(10);
	expect(u.state.faults.list()).toEqual([]);
});

test("one card when the heartbeat is three ticks old, gone when the worker writes one again", async () => {
	let sleeps = 0;
	const seen: { sleeps: number; codes: string[] }[] = [];
	let worker: Child | undefined;

	const u = unit({
		spawn: () => (worker = hangs()),
		sleep: async (ms) => {
			// What the view would read as this tick begins, before the script looks at the heartbeat.
			seen.push({ sleeps: ++sleeps, codes: u.cardsInStatus().map((c) => c.code) });
			u.clock.at += ms;

			if (sleeps === 6) writeHeartbeat(u.state.heartbeatPath, { time: u.clock.at, engineVersion: "0.1.0", configHash: "h", inFlight: [], intervalMs: TICK });

			if (sleeps === 8) u.stop.abort();
		},
	});

	expect(await u.run()).toBe("stopped");
	expect(worker).toBeDefined();
	// Three ticks without a heartbeat show the card; the heartbeat written during tick 6 clears it by tick 7.
	expect(seen.map((s) => s.codes.length)).toEqual([0, 0, 0, 1, 1, 1, 0, 0]);
	expect(seen[3]?.codes).toEqual(["worker-down"]);
});

test("the token card shows 30 days before the year ends, once, and clears when the date moves", () => {
	const u = unit({ spawn: () => exited(0) });
	const madeAgo = (days: number) => new Date(NOW - days * DAY).toISOString().slice(0, 10);

	checkTokenAge(u.state.faults, madeAgo(300), NOW);
	expect(u.state.faults.list()).toEqual([]);

	checkTokenAge(u.state.faults, madeAgo(340), NOW);
	checkTokenAge(u.state.faults, madeAgo(340), NOW + DAY);
	expect(u.state.faults.list().map((c) => c.code)).toEqual(["token-expiring"]);
	expect(u.state.faults.list()[0]?.fix).toContain("claude setup-token");

	checkTokenAge(u.state.faults, madeAgo(0), NOW);
	expect(u.state.faults.list()).toEqual([]);
});

test("a worker's tick shows the card from the config's token date", async () => {
	const old = new Date(NOW - 340 * DAY).toISOString().slice(0, 10);
	const w = await world({}, { config: configWith((raw) => void (raw.hum.ciToken = { setUp: old })) });

	await w.worker.tick();

	const status = readStatus(w.state.statusPath);

	expect(status.ok && status.status.cards.map((c) => c.code)).toEqual(["token-expiring"]);
});

test("a 401 holds the item where it is with one card naming claude setup-token; the next run that gets through clears it", async () => {
	const w = await world({ script: [{}, { error: "Failed to authenticate. API Error: 401 Invalid bearer token" }, { error: "Failed to authenticate. API Error: 401 Invalid bearer token" }, { commitForItem: true }] });

	w.item("a", "docs/a.md");
	await w.worker.tick();
	await w.worker.idle();

	expect(w.results.at(-1)).toMatchObject({ outcome: "held", item: "a" });
	expect(w.state.parked.get("a")).toBeUndefined();
	expect(w.repo.show("a")).toContain("state: ready");

	expect(w.state.faults.list().map((c) => c.code)).toEqual(["token-rejected"]);
	expect(w.state.faults.list()[0]?.fix).toContain("claude setup-token");

	// The claim holds the item until it lapses; then the item is tried again and refused again, still with one card, now in the status file.
	expect(await w.worker.tick()).toEqual({ kind: "ran", started: [] });
	w.clock.at += TTL + 1;
	await w.worker.tick();
	await w.worker.idle();

	const status = readStatus(w.state.statusPath);

	expect(status.ok && status.status.cards.map((c) => c.code)).toEqual(["token-rejected"]);
	expect(w.state.faults.list()).toHaveLength(1);

	w.clock.at += TTL + 1;
	await w.worker.tick();
	await w.worker.idle();

	expect(w.results.at(-1)).toMatchObject({ outcome: "merged", item: "a" });
	expect(w.state.faults.list().map((c) => c.code)).not.toContain("token-rejected");
});

test("the scheduled workflow's tick is a ref on the remote; the Mac reads its time", async () => {
	const repo = new WorkRepo();

	cleanups.push(() => rmSync(repo.root, { recursive: true, force: true }));

	const mac = repo.worker("mac");

	expect(await readCiTick(mac, "origin")).toBeUndefined();

	await recordCiTick(repo.owner, "origin", NOW);
	expect(await readCiTick(mac, "origin")).toBe(NOW);

	await recordCiTick(repo.owner, "origin", NOW + 900_000);
	expect(await readCiTick(mac, "origin")).toBe(NOW + 900_000);
	expect(sh(repo.remote, ["for-each-ref", "--format=%(refname)", "refs/hum"]).trim()).toBe(CI_TICK_REF);
	// The tick is no branch and no file: main is as it was.
	expect(sh(repo.remote, ["rev-list", "--count", "main"]).trim()).toBe("1");
});

test("with the schedule off, a question past its deadline fires on the next event, and the status shows the tick as old", async () => {
	const lastTick = NOW;
	const w = await world({ items: { a: { commitForItem: true, askUnlessAnswered: "Which?" } } }, { worker: { ciTick: async () => lastTick } });

	w.item("a", "docs/a.md");
	await w.worker.tick();
	await w.worker.idle();
	expect(w.results.at(-1)).toMatchObject({ outcome: "asked" });

	// Three days pass and no scheduled run comes. An answer-less event, such as a comment on another thread, wakes a tick.
	w.clock.at += 3 * DAY;
	await w.worker.tick();

	const status = readStatus(w.state.statusPath);

	expect(w.state.parked.get("a")).toMatchObject({ why: "stuck" });
	expect(status.ok && status.status.workers.ci).toBe(lastTick);
	expect(status.ok && w.clock.at - (status.status.workers.ci ?? 0)).toBe(3 * DAY);
});

test("CI wake: ticks until a tick starts nothing, so a run that frees another item is followed by that item's run", async () => {
	const w = await world({ items: { a: { commitForItem: true }, b: { commitForItem: true } } }, { settings: { runners: 1 } });

	w.item("a", "docs/a.md");
	w.item("b", "docs/b.md");
	await wakeUntilQuiet(w.worker);

	expect(w.results.filter((r) => r.outcome === "merged").map((r) => r.item).sort()).toEqual(["a", "b"]);
});
