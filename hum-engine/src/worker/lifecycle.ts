import { createActor, createAsyncLogic, setup, toPromise } from "xstate";
import { z } from "zod";

export type TickResult =
	| { readonly kind: "ran"; readonly started: readonly string[] }
	/** An update was seen; no new run starts, and the worker exits once its runs end. */
	| { readonly kind: "draining"; readonly reason: string }
	| { readonly kind: "exit"; readonly reason: string };

export type Exit = { readonly reason: string };

export type LifecycleOptions = {
	readonly tick: () => Promise<TickResult>;
	/** Stops every run in flight and resolves once they have ended. */
	readonly stopRuns: () => Promise<void>;
	readonly tickIntervalMs: number;
	readonly drainTimeoutMs: number;
};

type Phase = "serving" | "draining" | "exited";

/** Where a tick's result leads, whichever phase the worker was in. */
const PHASE_AFTER = { ran: "serving", draining: "draining", exit: "exited" } as const satisfies Record<TickResult["kind"], Phase>;

const Context = z.object({ woken: z.boolean(), reason: z.string() });

type Context = z.infer<typeof Context>;

const STOPPED: Exit = { reason: "stopped" };

/** The transition after a tick: to the phase its result names, else straight into the next tick when woken, else to rest. */
const afterTick = (phase: Exclude<Phase, "exited">, context: Context, result: TickResult) => {
	const next = PHASE_AFTER[result.kind];
	const reason = result.kind === "ran" ? context.reason : result.reason;

	if (next === "exited") return { target: "#worker.exited", context: { ...context, reason } };

	if (next !== phase) return { target: `#worker.${next}.resting`, context: { ...context, reason } };

	return context.woken ? { target: "ticking", reenter: true } : { target: "resting" };
};

/**
 * The worker's life as a machine. It ticks, rests for the tick interval, and ticks again at once when woken; a
 * wake that arrives during a tick makes one more tick, however many arrive. A tick that sees an update moves it to
 * draining, where it still ticks, so claims are renewed and the heartbeat stays fresh, and the runs still going
 * are stopped once the drain timeout passes. It ends when a tick finds nothing left to wait for, or on `stop`.
 */
const lifecycleMachine = ({ tick, stopRuns, tickIntervalMs, drainTimeoutMs }: LifecycleOptions) => {
	const worker = setup({
		schemas: { context: Context, events: { wake: z.object({}), stop: z.object({}) } },
		delays: { tickInterval: tickIntervalMs, drainTimeout: drainTimeoutMs },
		actors: { tick: createAsyncLogic({ run: tick }), stopRuns: createAsyncLogic({ run: stopRuns }) },
	});

	const cycle = (phase: Exclude<Phase, "exited">) =>
		({
			ticking: {
				entry: ({ context }: { context: Context }) => ({ context: { ...context, woken: false } }),
				invoke: { src: "tick", onDone: ({ context, event }: { context: Context; event: { output: TickResult } }) => afterTick(phase, context, event.output) },
				on: { wake: ({ context }: { context: Context }) => ({ context: { ...context, woken: true } }) },
			},
			resting: {
				after: { tickInterval: { target: "ticking" } },
				on: { wake: { target: "ticking" } },
			},
		}) as const;

	return worker.createMachine({
		id: "worker",
		context: { woken: false, reason: "" },
		initial: "serving",
		on: { stop: { target: "#worker.stopping" } },
		states: {
			serving: { initial: "ticking", states: cycle("serving") },
			draining: { initial: "ticking", states: cycle("draining"), after: { drainTimeout: (_, enq) => void enq(() => void stopRuns()) } },
			stopping: { on: { stop: undefined }, invoke: { src: "stopRuns", onDone: { target: "stopped" } } },
			exited: { type: "final", output: ({ context }): Exit => ({ reason: context.reason }) },
			stopped: { type: "final", output: STOPPED },
		},
	});
};

export type Lifecycle = { readonly wake: () => void; readonly ended: Promise<Exit> };

/** Starts the machine. `stop` ends it after the runs have stopped; `wake` asks for a tick now. */
export const runLifecycle = (options: LifecycleOptions, stop?: AbortSignal): Lifecycle => {
	const actor = createActor(lifecycleMachine(options)).start();
	const halt = () => actor.send({ type: "stop" });

	if (stop?.aborted) halt();
	else stop?.addEventListener("abort", halt, { once: true });

	const ended: Promise<Exit> = toPromise(actor).finally(() => stop?.removeEventListener("abort", halt));

	return { wake: () => actor.send({ type: "wake" }), ended };
};
