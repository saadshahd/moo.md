import { expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { CI_TICK_REF, readCiTick, recordCiTick } from "../src/service/ci-tick.ts";
import { backoffFor, type Child, EXIT_UPDATED, supervise, type Supervision } from "../src/service/supervise.ts";
import { checkTokenAge } from "../src/service/token.ts";
import { doesStopWake, wakeUntilQuiet } from "../src/service/wake.ts";
import { programDifferences } from "../src/service/program.ts";
import { programStatus, statusReport } from "../src/service/program-status.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { alone } from "../src/state/alone.ts";
import { openState } from "../src/state/open.ts";
import { emptyStatus, readStatus, writeHeartbeat } from "../src/status/file.ts";
import { configWith } from "./fixtures/config.ts";
import { OWNER } from "./fixtures/identity.ts";
import { until } from "./fixtures/process.ts";
import { sh, WorkRepo } from "./fixtures/work-repo.ts";
import { NOW, TTL, workerWorld } from "./fixtures/worker-world.ts";
import { SHIPPED_COMMAND_TIMEOUT_MS } from "../src/exec.ts";
import { tempDir } from "./fixtures/temp.ts";

const DAY = 86_400_000;
const WARN_DAYS = SHIPPED_DEFAULTS.tokenWarnDays;

const TICK_MS = 20;

/** The service unit's start script over a state folder in a temp dir, on short real intervals. */
const unit = (over: Partial<Supervision> & { spawn: () => Child }) => {
	const state = openState(tempDir("unit"), { now: Date.now });
	const stop = new AbortController();

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

test("a restart waits backoffMs, doubled for each crash in the window, and never longer than maxBackoffMs", () => {
	expect([1, 2, 3, 4, 5, 6].map((crashes) => backoffFor(crashes, { backoffMs: 20, maxBackoffMs: 100 }))).toEqual([20, 40, 80, 100, 100, 100]);
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
	const { faults } = openState(tempDir("token"), { now: Date.now });
	const madeAgo = (days: number) => new Date(NOW - days * DAY).toISOString().slice(0, 10);

	checkTokenAge(faults, { setUp: madeAgo(300), now: NOW, warnDays: WARN_DAYS });
	expect(faults.list()).toEqual([]);

	checkTokenAge(faults, { setUp: madeAgo(340), now: NOW, warnDays: WARN_DAYS });
	checkTokenAge(faults, { setUp: madeAgo(340), now: NOW + DAY, warnDays: WARN_DAYS });
	expect(faults.list().map((c) => c.code)).toEqual(["token-expiring"]);
	expect(faults.list()[0]?.fix).toContain("claude setup-token");

	checkTokenAge(faults, { setUp: madeAgo(0), now: NOW, warnDays: WARN_DAYS });
	expect(faults.list()).toEqual([]);
});

test("a worker's tick shows the card from the config's token date", async () => {
	const old = new Date(NOW - 340 * DAY).toISOString().slice(0, 10);
	const w = await workerWorld({}, { config: configWith((raw) => void (raw.hum.ciToken = { setUp: old })) });

	await w.worker.tick();

	const status = readStatus(w.state.statusPath);

	expect(status.ok && status.status.cards.map((c) => c.code)).toEqual(["token-expiring"]);
});

test("a 401 holds the item where it is with one card naming claude setup-token; the next run that gets through clears it", async () => {
	const w = await workerWorld({ script: [{}, { error: "Failed to authenticate. API Error: 401 Invalid bearer token" }, { error: "Failed to authenticate. API Error: 401 Invalid bearer token" }, { writeForItem: true }] });

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

test("in a CI wake a card that only informs stops nothing, a card that stops only its own item among them, and every other card stops the wake", () => {
	const codes = ["signal-not-applied", "token-expiring", "credential-changed", "item-unread", "item-stuck", "item-review", "item-claimed", "token-rejected", "review-loop", "run-error", "snapshot-unreadable"];

	expect(codes.filter((code) => doesStopWake({ code }))).toEqual(["token-rejected", "review-loop", "run-error", "snapshot-unreadable"]);
});

test("the scheduled workflow's tick is a ref on the remote; the Mac reads its time", async () => {
	const repo = new WorkRepo();

	const mac = repo.worker("mac");

	expect(await readCiTick({ repo: mac, remote: "origin", timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS })).toBeUndefined();

	await recordCiTick({ repo: repo.owner, remote: "origin", at: NOW, identity: OWNER, timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS });
	expect(await readCiTick({ repo: mac, remote: "origin", timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS })).toBe(NOW);

	await recordCiTick({ repo: repo.owner, remote: "origin", at: NOW + 900_000, identity: OWNER, timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS });
	expect(await readCiTick({ repo: mac, remote: "origin", timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS })).toBe(NOW + 900_000);
	expect(sh(repo.remote, ["for-each-ref", "--format=%(refname)", "refs/hum"]).trim()).toBe(CI_TICK_REF);
	// The tick is no branch and no file: main is as it was.
	expect(sh(repo.remote, ["rev-list", "--count", "main"]).trim()).toBe("1");
});

test("CI wake: ticks until a tick starts nothing, so a run that frees another item is followed by that item's run, and saves after each tick once its runs end", async () => {
	const w = await workerWorld({ items: { a: { writeForItem: true }, b: { writeForItem: true } } }, { settings: { runners: 1 } });
	const mergedAtEachSave: number[] = [];

	w.item("a", "docs/a.md");
	w.item("b", "docs/b.md");
	await wakeUntilQuiet(w.worker, async () => void mergedAtEachSave.push(w.results.filter((r) => r.outcome === "merged").length));

	expect(w.results.filter((r) => r.outcome === "merged").map((r) => r.item).sort()).toEqual(["a", "b"]);
	expect(mergedAtEachSave).toEqual([1, 2, 2]);
});

test("a Program entry that differs from the one setup printed names each field that differs, in the App's words; a matching entry in its own Terminal names none", () => {
	const printed = { argv: ["/bin/bun", "/repo/node_modules/.bin/hum", "serve"], dir: ".", adoptDir: ".hum-slots" };

	expect(programDifferences({ entry: printed, isThisProcess: true }, printed)).toEqual([]);
	expect(programDifferences({ entry: null, isThisProcess: false }, printed)).toEqual(["this Project names no Program"]);
	expect(programDifferences({ entry: { argv: ["bunx", "hum", "serve"], dir: "." }, isThisProcess: true }, printed)).toEqual([
		'its Command is "bunx hum serve", where setup printed "/bin/bun /repo/node_modules/.bin/hum serve"',
		'its Worktree path is "", where setup printed ".hum-slots"',
	]);
	expect(programDifferences({ entry: printed, isThisProcess: false }, printed)).toEqual(["this hum serve is not the Program roundup started"]);
});

/** The state and label an OSC 7501 report carries. */
const reported = (report: string) => ({ state: /;state=(\w+)/u.exec(report)?.[1], label: Buffer.from(/:msg=([A-Za-z0-9+/=]*)/u.exec(report)?.[1] ?? "", "base64").toString() });

test("hum's status reads as one OSC 7501 record: its newest fault first, then the items in flight, else idle; its label is one line of at most 200 characters", () => {
	const status = emptyStatus("1.0.0", 0);
	const fault = (cause: string, since: number) => ({ kind: "fault" as const, key: cause, code: cause, cause, fix: "fix it", since });
	const item = (id: string) => ({ item: id, title: `item ${id}`, state: "building", since: 0, unclear: false });

	expect(reported(statusReport(programStatus({ ok: false, reason: "missing", message: "gone" })))).toEqual({ state: "idle", label: "" });
	expect(reported(statusReport(programStatus({ ok: true, status })))).toEqual({ state: "idle", label: "no item in flight" });
	expect(reported(statusReport(programStatus({ ok: true, status: { ...status, inFlight: [item("12"), item("13")] } })))).toEqual({ state: "working", label: "#12 item 12: building and 1 more" });
	expect(reported(statusReport(programStatus({ ok: true, status: { ...status, inFlight: [item("12")], cards: [fault("old", 1), fault("new\nline", 2)] } })))).toEqual({ state: "error", label: "new line and 1 more" });
	expect(reported(statusReport(programStatus({ ok: true, status: { ...status, cards: [fault("x".repeat(300), 1)] } }))).label).toBe(`${"x".repeat(199)}…`);
});

test("a second `hum work` on one state folder is refused, naming it, while `hum serve` there is not", async () => {
	const dir = tempDir("alone");
	const kept = Promise.withResolvers<void>();
	const lost = () => {};
	const held = alone(dir, "work", lost, () => kept.promise);

	await expect(alone(dir, "work", lost, async () => "second")).rejects.toThrow(`another \`hum work\` runs on ${dir}`);
	expect(await alone(dir, "serve", lost, async () => "serve")).toBe("serve");

	kept.resolve();
	await held;
	expect(await alone(dir, "work", lost, async () => "after")).toBe("after");
}, 20_000);
