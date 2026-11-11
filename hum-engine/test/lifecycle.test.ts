import { expect, test } from "bun:test";
import { runLifecycle, type TickResult } from "../src/worker/lifecycle.ts";

const RAN: TickResult = { kind: "ran", started: [] };

const DRAINING: TickResult = { kind: "draining", reason: "the engine changed" };

const EXIT: TickResult = { kind: "exit", reason: "the engine changed" };

const HOUR_MS = 3_600_000;

test("wakes that arrive during a tick make one more tick, however many arrive", async () => {
	const busy = Promise.withResolvers<void>();
	const secondTick = Promise.withResolvers<void>();
	const ticks: number[] = [];

	const tick = async (): Promise<TickResult> => {
		ticks.push(ticks.length);

		if (ticks.length === 1) await busy.promise;

		if (ticks.length === 2) secondTick.resolve();

		return RAN;
	};

	const stop = new AbortController();
	const life = runLifecycle({ tick, stopRuns: async () => {}, tickIntervalMs: HOUR_MS, drainTimeoutMs: HOUR_MS }, stop.signal);

	for (let wake = 0; wake < 20; wake++) life.wake();
	busy.resolve();
	await secondTick.promise;
	// A third tick would start in the microtasks that end the second; one macrotask later every one of them has run.
	await new Promise((resolve) => setImmediate(resolve));

	expect(ticks).toHaveLength(2);

	stop.abort();
	expect(await life.ended).toEqual({ reason: "stopped" });
});

test("a draining worker keeps ticking, stops its runs once the drain timeout passes, and exits when a tick says so", async () => {
	const stopped: number[] = [];
	const results = [DRAINING, DRAINING, DRAINING];
	let ticks = 0;

	const tick = async (): Promise<TickResult> => (stopped.length > 0 ? EXIT : (results[ticks++] ?? DRAINING));

	const life = runLifecycle({ tick, stopRuns: async () => void stopped.push(ticks), tickIntervalMs: 5, drainTimeoutMs: 40 });

	expect(await life.ended).toEqual({ reason: "the engine changed" });
	expect(stopped).toHaveLength(1);
	expect(ticks).toBeGreaterThan(1);
});

test("stop stops the runs, then ends", async () => {
	const stopped: string[] = [];
	const stop = new AbortController();
	const life = runLifecycle({ tick: async () => RAN, stopRuns: async () => void stopped.push("runs"), tickIntervalMs: HOUR_MS, drainTimeoutMs: HOUR_MS }, stop.signal);

	stop.abort();

	expect(await life.ended).toEqual({ reason: "stopped" });
	expect(stopped).toEqual(["runs"]);
});
