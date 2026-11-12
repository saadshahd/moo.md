import { createActor, createAsyncLogic, setup, toPromise } from "xstate";
import { z } from "zod";
import { ENGINE_VERSION } from "../state/format.ts";
import type { State } from "../state/open.ts";
import { readHeartbeat, writeCards } from "../status/file.ts";
import { MINUTE_MS, SECOND_MS } from "../time.ts";
import { CARD_CODES, CARD_KINDS } from "./cards.ts";

/** The exit code of a worker that stopped because an update arrived. `EX_TEMPFAIL`: the supervisor starts it again without counting a crash. */
export const EXIT_UPDATED = 75;

/** A worker process, or a stand-in for one. */
export type Child = { readonly exited: Promise<number>; readonly kill: () => void };

export type Supervision = {
	readonly state: Pick<State, "faults" | "heartbeatPath" | "statusPath">;
	readonly spawn: () => Child;
	readonly now: () => number;
	/** The time between heartbeat looks, and the worker's tick interval until it writes a heartbeat. */
	readonly intervalMs: number;
	readonly workerDownTicks: number;
	readonly maxCrashes: number;
	readonly crashWindowMs: number;
	/** The pause before the first restart, doubled for each crash still inside the window, up to `maxBackoffMs`. */
	readonly backoffMs: number;
	readonly maxBackoffMs: number;
	readonly stop: AbortSignal;
};

export type Ended = "stopped" | "gave-up";

const Context = z.object({
	crashes: z.array(z.number()),
	/** The last time anything showed the worker alive, or the start. A restart does not move it, so a worker that exits at start still goes stale. */
	quietSince: z.number(),
});

type Context = z.infer<typeof Context>;

type Card = ReturnType<(typeof CARD_KINDS)["workerSilent"]> | undefined;

/** Shows `card` as the only worker-down card, or none; the status file is written here because no worker is there to write it. */
const showWorkerDown = ({ faults, statusPath }: Supervision["state"], card: Card, now: number): void => {
	faults.clear({ code: CARD_CODES.workerDown });

	if (card) faults.raise(card);

	writeCards(statusPath, faults.list(), ENGINE_VERSION, now);
};

const isUpdateExit = (exitCode: number): boolean => exitCode === EXIT_UPDATED;

const crashesInWindow = (crashes: readonly number[], at: number, windowMs: number): number[] => [...crashes.filter((crashed) => at - crashed < windowMs), at];

type Silence = { readonly quietSince: number; readonly silentMs: number; readonly isSilent: boolean };

/** How long nothing has shown the worker alive, and whether that is `ticks` of the worker's own tick interval. */
const silenceOf = (quietSince: number, beat: { readonly time: number; readonly intervalMs: number } | undefined, now: number, o: Pick<Supervision, "intervalMs" | "workerDownTicks">): Silence => {
	const lastSeen = Math.max(quietSince, beat?.time ?? 0);
	const silentMs = now - lastSeen;

	return { quietSince: lastSeen, silentMs, isSilent: silentMs >= o.workerDownTicks * (beat?.intervalMs ?? o.intervalMs) };
};

/** The pause before a restart once `crashes` crashes sit inside the window. */
export const backoffFor = (crashes: number, { backoffMs, maxBackoffMs }: Pick<Supervision, "backoffMs" | "maxBackoffMs">): number => Math.min(backoffMs * 2 ** (crashes - 1), maxBackoffMs);

/**
 * The start script as a machine. It runs the worker and starts it again when it exits, looks at the heartbeat once
 * a tick, and stops restarting after too many crashes in the window. Giving up ends it as `gave-up`, so the
 * unit's exit code is 0 and the unit does not start the script again.
 */
const supervisorMachine = (o: Supervision, current: { child?: Child }) => {
	const supervisor = setup({
		schemas: { context: Context, events: { stop: z.object({}) } },
		delays: { tick: o.intervalMs, backoff: ({ context }) => backoffFor(context.crashes.length, o) },
		actors: {
			worker: createAsyncLogic({ run: () => (current.child = o.spawn()).exited }),
			exit: createAsyncLogic({ run: () => current.child?.exited ?? Promise.resolve(0) }),
		},
	});

	const hasReachedLimit = (crashes: readonly number[]): boolean => crashes.length >= o.maxCrashes;

	const looking = {
		after: {
			tick: ({ context }: { context: Context }, enq: (effect: () => void) => void) => {
				const now = o.now();
				const { quietSince, silentMs, isSilent } = silenceOf(context.quietSince, readHeartbeat(o.state.heartbeatPath), now, o);
				const isShown = o.state.faults.list().some((card) => card.key === CARD_CODES.workerDown);
				const mustChangeCard = isSilent !== isShown;

				if (mustChangeCard) enq(() => showWorkerDown(o.state, isSilent ? CARD_KINDS.workerSilent({ seconds: Math.round(silentMs / SECOND_MS), ticks: o.workerDownTicks }) : undefined, now));

				return { target: "looking", reenter: true, context: { ...context, quietSince } };
			},
		},
	};

	return supervisor.createMachine({
		id: "supervisor",
		context: { crashes: [], quietSince: o.now() },
		initial: "running",
		on: { stop: { target: "#supervisor.stopping" } },
		states: {
			running: {
				initial: "looking",
				invoke: {
					src: "worker",
					onDone: ({ context, event }, enq) => {
						const exitCode = event.output;

						if (isUpdateExit(exitCode)) return { target: "running", reenter: true };

						const now = o.now();
						const crashes = crashesInWindow(context.crashes, now, o.crashWindowMs);

						if (!hasReachedLimit(crashes)) return { target: "backingOff", context: { ...context, crashes } };

						enq(() => showWorkerDown(o.state, CARD_KINDS.workerGaveUp({ crashes: crashes.length, windowMinutes: Math.round(o.crashWindowMs / MINUTE_MS), exitCode }), now));

						return { target: "gaveUp", context: { ...context, crashes } };
					},
				},
				states: { looking },
			},
			backingOff: { initial: "looking", after: { backoff: { target: "running" } }, states: { looking } },
			stopping: { entry: (_, enq) => void enq(() => current.child?.kill()), invoke: { src: "exit", onDone: { target: "stopped" } }, on: { stop: undefined } },
			gaveUp: { type: "final", output: "gave-up" as const },
			stopped: { type: "final", output: "stopped" as const },
		},
	});
};

/** Runs the start script until `stop` or the crash limit. */
export const supervise = (o: Supervision): Promise<Ended> => {
	const actor = createActor(supervisorMachine(o, {})).start();
	const halt = () => actor.send({ type: "stop" });

	showWorkerDown(o.state, undefined, o.now());

	if (o.stop.aborted) halt();
	else o.stop.addEventListener("abort", halt, { once: true });

	return toPromise(actor).finally(() => o.stop.removeEventListener("abort", halt));
};
