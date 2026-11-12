import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CI_TICK_REF, readCiTick, recordCiTick } from "../src/service/ci-tick.ts";
import { type Child, EXIT_UPDATED, supervise, type Supervision } from "../src/service/supervise.ts";
import { checkTokenAge } from "../src/service/token.ts";
import { wakeUntilQuiet } from "../src/service/wake.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { openState } from "../src/state/open.ts";
import { readStatus, writeHeartbeat } from "../src/status/file.ts";
import { configWith } from "./fixtures/config.ts";
import { OWNER } from "./fixtures/identity.ts";
import { until } from "./fixtures/process.ts";
import { sh, WorkRepo } from "./fixtures/work-repo.ts";
import { NOW, TTL, workerWorld, type WorkerWorld } from "./fixtures/worker-world.ts";
import { SHIPPED_COMMAND_TIMEOUT_MS } from "../src/exec.ts";

const DAY = 86_400_000;
const WARN_DAYS = SHIPPED_DEFAULTS.tokenWarnDays;

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

const TICK_MS = 20;

/** The service unit's start script over a state folder in a temp dir, on short real intervals. */
const unit = (over: Partial<Supervision> & { spawn: () => Child }) => {
	const state = openState(mkdtempSync(join(tmpdir(), "hum-unit-")));
	const stop = new AbortController();

	cleanups.push(() => rmSync(state.dir, { recursive: true, force: true }));

	const supervision: Supervision = {
		state,
		now: Date.now,
		intervalMs: TICK_MS,
		workerDownTicks: SHIPPED_DEFAULTS.workerDownTicks,
		maxCrashes: SHIPPED_DEFAULTS.maxCrashes,
		crashWindowMs: 10 * 60_000,
		backoffMs: 1,
		maxBackoffMs: 60_000,
		stop: stop.signal,
		...over,
	};

	const cardsInStatus = () => {
		const read = readStatus(state.statusPath);

		if (!read.ok) throw new Error(read.message);

		return read.status.cards;
	};

	return { state, stop, run: () => supervise(supervision), cardsInStatus };
};

const exited = (code: number): Child => ({ exited: Promise.resolve(code), kill: () => {} });

/** A worker that never exits until it is told to. */
const hangs = (): Child => {
	const ended = Promise.withResolvers<number>();

	return { exited: ended.promise, kill: () => ended.resolve(0) };
};

test("a worker that exits at start is restarted until the crash limit, then one card shows and the script stops", async () => {
	let spawns = 0;
	const u = unit({ spawn: () => (spawns++, exited(1)) });

	expect(await u.run()).toBe("gave-up");
	expect(spawns).toBe(SHIPPED_DEFAULTS.maxCrashes);
	expect(u.cardsInStatus()).toHaveLength(1);
	expect(u.cardsInStatus()[0]).toMatchObject({ code: "worker-down" });
	expect(u.cardsInStatus()[0]?.cause).toContain("Restarts have stopped");
	expect(readdirSync(join(u.state.dir, "faults"))).toHaveLength(1);
});

test("crashes spread over more than the window do not stop the restarts", async () => {
	let spawns = 0;

	const u = unit({
		crashWindowMs: TICK_MS,
		backoffMs: 4 * TICK_MS,
		maxBackoffMs: 4 * TICK_MS,
		spawn: () => {
			if (++spawns === 2 * SHIPPED_DEFAULTS.maxCrashes) u.stop.abort();

			return exited(1);
		},
	});

	expect(await u.run()).toBe("stopped");
	expect(spawns).toBe(2 * SHIPPED_DEFAULTS.maxCrashes);
	expect(u.cardsInStatus().map((c) => c.cause).join()).not.toContain("Restarts have stopped");
});

test("restarts never wait longer than maxBackoffMs", async () => {
	const spawnedAt: number[] = [];

	const u = unit({
		crashWindowMs: 60_000,
		maxCrashes: 10,
		backoffMs: 20,
		maxBackoffMs: 20,
		spawn: () => {
			spawnedAt.push(Date.now());

			if (spawnedAt.length === 6) u.stop.abort();

			return exited(1);
		},
	});

	await u.run();

	const gaps = spawnedAt.slice(1).map((at, index) => at - spawnedAt[index]!);

	expect(Math.max(...gaps)).toBeLessThan(150);
});

test("a worker that exits to take an update is started again and never counts as a crash", async () => {
	let spawns = 0;
	const u = unit({ spawn: () => (spawns++ === 9 ? (u.stop.abort(), exited(0)) : exited(EXIT_UPDATED)) });

	expect(await u.run()).toBe("stopped");
	expect(spawns).toBe(10);
	expect(u.state.faults.list()).toEqual([]);
});

test("one card shows when the heartbeat is old and clears when the worker writes one again", async () => {
	const u = unit({ spawn: hangs });
	const run = u.run();

	try {
		await until(() => u.cardsInStatus().length === 1);
		expect(u.cardsInStatus()[0]).toMatchObject({ code: "worker-down" });

		writeHeartbeat(u.state.heartbeatPath, { time: Date.now(), engineVersion: "0.1.0", configHash: "h", inFlight: [], intervalMs: 10 * 60_000 });
		await until(() => u.cardsInStatus().length === 0);
	} finally {
		u.stop.abort();
	}

	expect(await run).toBe("stopped");
});

test("the token card shows the warning lead before the year ends, once, and clears when the date moves", () => {
	const { faults } = openState(mkdtempSync(join(tmpdir(), "hum-token-")));
	const madeAgo = (days: number) => new Date(NOW - days * DAY).toISOString().slice(0, 10);

	checkTokenAge(faults, madeAgo(300), NOW, WARN_DAYS);
	expect(faults.list()).toEqual([]);

	checkTokenAge(faults, madeAgo(340), NOW, WARN_DAYS);
	checkTokenAge(faults, madeAgo(340), NOW + DAY, WARN_DAYS);
	expect(faults.list().map((c) => c.code)).toEqual(["token-expiring"]);
	expect(faults.list()[0]?.fix).toContain("claude setup-token");

	checkTokenAge(faults, madeAgo(0), NOW, WARN_DAYS);
	expect(faults.list()).toEqual([]);
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

	expect(await readCiTick(mac, "origin", SHIPPED_COMMAND_TIMEOUT_MS)).toBeUndefined();

	await recordCiTick(repo.owner, "origin", NOW, OWNER, SHIPPED_COMMAND_TIMEOUT_MS);
	expect(await readCiTick(mac, "origin", SHIPPED_COMMAND_TIMEOUT_MS)).toBe(NOW);

	await recordCiTick(repo.owner, "origin", NOW + 900_000, OWNER, SHIPPED_COMMAND_TIMEOUT_MS);
	expect(await readCiTick(mac, "origin", SHIPPED_COMMAND_TIMEOUT_MS)).toBe(NOW + 900_000);
	expect(sh(repo.remote, ["for-each-ref", "--format=%(refname)", "refs/hum"]).trim()).toBe(CI_TICK_REF);
	// The tick is no branch and no file: main is as it was.
	expect(sh(repo.remote, ["rev-list", "--count", "main"]).trim()).toBe("1");
});

test("CI wake: ticks until a tick starts nothing, so a run that frees another item is followed by that item's run", async () => {
	const w = await world({ items: { a: { commitForItem: true }, b: { commitForItem: true } } }, { settings: { runners: 1 } });

	w.item("a", "docs/a.md");
	w.item("b", "docs/b.md");
	await wakeUntilQuiet(w.worker);

	expect(w.results.filter((r) => r.outcome === "merged").map((r) => r.item).sort()).toEqual(["a", "b"]);
});
