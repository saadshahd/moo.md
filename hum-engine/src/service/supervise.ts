import { ENGINE_VERSION } from "../state/format.ts";
import type { State } from "../state/open.ts";
import { readHeartbeat, writeCards } from "../status/file.ts";

/** The exit code of a worker that stopped because an update arrived (V2). `EX_TEMPFAIL`: the supervisor starts it again without counting a crash. */
export const EXIT_UPDATED = 75;

/** A worker process, or a stand-in for one. */
export type Child = { readonly exited: Promise<number>; readonly kill: () => void };

export type Supervision = {
	readonly state: Pick<State, "faults" | "heartbeatPath" | "statusPath">;
	readonly spawn: () => Child;
	readonly now: () => number;
	/** Resolves after `ms`, or as soon as `cancel` fires; a cancelled sleep leaves no timer behind. */
	readonly sleep: (ms: number, cancel: AbortSignal) => Promise<void>;
	/** The time between worker ticks, for a worker that has written no heartbeat yet. */
	readonly intervalMs: number;
	/** R7: N crashes within M minutes stop the restarts. */
	readonly maxCrashes: number;
	readonly crashWindowMs: number;
	/** The pause before a restart, doubled for each crash still inside the window. */
	readonly backoffMs: number;
	readonly stop: AbortSignal;
};

const TICKS_STALE = 3;

const CARD = "worker-down";

const MAX_BACKOFF_MS = 60_000;

/**
 * R7: the start script. It runs the worker and starts it again when it exits, one card when the heartbeat is
 * three ticks old, and no more restarts after N crashes in M minutes, with one card. Gives up by returning
 * `"gave-up"`, so the unit's exit code is 0 and the unit does not start the script again.
 * Its cards are written to the status file here, because no worker is there to write them.
 */
export const supervise = async (o: Supervision): Promise<"stopped" | "gave-up"> => {
	let crashes: number[] = [];
	/** The last time anything showed the worker alive, or the start. A restart does not move it, so a worker that exits at start still goes stale. */
	let quietSince = o.now();

	const show = (cause?: string) => {
		o.state.faults.clear(CARD);

		if (cause) {
			o.state.faults.raise({
				code: CARD,
				cause,
				fix: "Look at the unit's log for the cause. Starting the unit again lets the worker start again.",
			});
		}

		writeCards(o.state.statusPath, o.state.faults.list(), ENGINE_VERSION, o.now());
	};

	/** Shows the card while the last sign of life is three ticks old. */
	const watch = () => {
		const beat = readHeartbeat(o.state.heartbeatPath);

		if (beat && beat.time > quietSince) quietSince = beat.time;

		const age = o.now() - quietSince;
		const stale = age >= TICKS_STALE * (beat?.intervalMs ?? o.intervalMs);
		const shown = o.state.faults.list().some((card) => card.key === CARD);

		if (stale && !shown) show(`The worker has written no heartbeat for ${Math.round(age / 1000)} seconds, ${TICKS_STALE} ticks.`);
		else if (!stale && shown) show();
	};

	/** Looks at the heartbeat once a tick until the worker exits, and returns its exit code. */
	const running = async (child: Child): Promise<number> => {
		for (;;) {
			const tick = new AbortController();
			const code = await Promise.race([child.exited, o.sleep(o.intervalMs, tick.signal).then(() => undefined)]);

			tick.abort();

			if (code !== undefined) return code;

			if (o.stop.aborted) return child.exited;

			watch();
		}
	};

	/** Pauses `ms`, looking at the heartbeat once a tick. */
	const pause = async (ms: number): Promise<void> => {
		for (let left = ms; left > 0 && !o.stop.aborted; left -= o.intervalMs) {
			await o.sleep(Math.min(left, o.intervalMs), o.stop);
			watch();
		}
	};

	show();

	while (!o.stop.aborted) {
		const child = o.spawn();
		const onStop = () => child.kill();

		o.stop.addEventListener("abort", onStop, { once: true });

		const code = await running(child);

		o.stop.removeEventListener("abort", onStop);

		if (o.stop.aborted) break;

		if (code === EXIT_UPDATED) continue;

		crashes = [...crashes.filter((at) => o.now() - at < o.crashWindowMs), o.now()];

		if (crashes.length >= o.maxCrashes) {
			show(`The worker exited ${crashes.length} times in ${Math.round(o.crashWindowMs / 60_000)} minutes, the last with code ${code}. Restarts have stopped.`);

			return "gave-up";
		}

		await pause(Math.min(o.backoffMs * 2 ** (crashes.length - 1), MAX_BACKOFF_MS));
	}

	return "stopped";
};
