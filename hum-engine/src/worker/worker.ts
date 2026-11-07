import { mkdirSync, readFileSync, rmSync, watch } from "node:fs";
import { ADAPTER_API_VERSION, type Answers, type Item, type ItemRef, type Questions, type WorkSource } from "../adapter-api.ts";
import type { ClaudeRunner } from "../adapters/claude-p.ts";
import type { Config } from "../config/load.ts";
import { SCHEMA_VERSION } from "../config/schema.ts";
import { createAsyncLogic } from "xstate";
import { listFiles } from "../state/fs.ts";
import { ENGINE_VERSION } from "../state/format.ts";
import { persistedSnapshot, type SavedSnapshot } from "../state/items.ts";
import type { State } from "../state/open.ts";
import { checkTokenAge } from "../service/token.ts";
import { readStatus, writeHeartbeat, writeStatus } from "../status/file.ts";
import { emptyStatus, type Status } from "../status/format.ts";
import { type Candidate, type Footprint, footprintOf, pick, PrefixGate, Wake } from "./scheduler.ts";
import { type Signature, signatureOf } from "./signature.ts";
import { answerTo, DEFAULT_CLAIM_TTL_MS, park, rememberKinds, runThinPath, type ThinResult } from "./thin-path.ts";
import { OWNER_WAIT_TAG, STUCK_TAG, type Kind } from "../config/schema.ts";

export type WorkerOptions = {
	/** The owner's checkout: its lockfile, `.hum/` and `adapters/` are what the update check watches. */
	readonly repo: string;
	readonly state: State;
	readonly config: Config;
	readonly adapters: { readonly workSource: WorkSource; readonly questions: Questions; readonly answers?: Answers };
	/** Started: `runner.start()` has passed. */
	readonly runner: ClaudeRunner;
	/** The kind of an item. */
	readonly kind: (item: Item) => string;
	readonly remote: string;
	readonly base?: string;
	readonly checks: readonly string[];
	readonly holder: string;
	readonly claimTtlMs?: number;
	readonly workDir?: string;
	readonly dir?: string;
	readonly maxFixes?: number;
	/** The most runs at once. */
	readonly runners?: number;
	readonly intervalMs?: number;
	/** How long a worker that has seen an update waits for its runs before it stops them. */
	readonly drainMs?: number;
	readonly where?: "mac" | "ci";
	readonly now?: () => number;
	/** The engine this process runs; the update check compares the one installed in `repo` with the one at start. */
	readonly engineVersion?: string;
	/** The newest published version. Read at most every six hours; a failure shows no version. */
	readonly latestVersion?: () => Promise<string | undefined>;
	/** When the scheduled workflow last ran, for the status file. Read at most every five minutes; a failure shows no time. */
	readonly ciTick?: () => Promise<number | undefined>;
	readonly gate?: PrefixGate;
	readonly onResult?: (result: ThinResult) => void;
};

export type TickResult =
	| { readonly kind: "ran"; readonly started: readonly string[] }
	/** An update was seen; no new run starts, and the worker exits once its runs end. */
	| { readonly kind: "draining"; readonly reason: string }
	| { readonly kind: "exit"; readonly reason: string };

type Running = { readonly abort: AbortController; readonly since: number; readonly title: string; readonly done: Promise<void> };

type Known = { readonly footprint: Footprint; readonly kind: string; readonly title: string };

const LATEST_EVERY_MS = 6 * 60 * 60_000;

const CI_TICK_EVERY_MS = 5 * 60_000;

/** Reads `read` at most every `everyMs`; a failed read shows no value. */
const throttled = <T>(read: (() => Promise<T | undefined>) | undefined, everyMs: number) => {
	let last: { value: T | undefined; at: number } | undefined;

	return async (t: number): Promise<T | undefined> => {
		if (!read) return undefined;

		if (!last || t - last.at >= everyMs) last = { value: await read().catch(() => undefined), at: t };

		return last.value;
	};
};

/** Machine states never settle, so a restored item can be stepped by its timers without starting a run. */
const neverSources = (kind: Kind) =>
	Object.fromEntries(Object.values(kind.machine.states).flatMap((node) => (node.invoke ? [[node.invoke.src, createAsyncLogic({ run: () => new Promise<never>(() => {}) })]] : [])));

const hasTag = (kind: Kind, state: string | undefined, tag: string): boolean => (state !== undefined && kind.machine.states[state]?.tags?.includes(tag)) ?? false;

/**
 * The worker. Each tick reads its facts once, then decides: it checks deadlines, renews claims, compares the
 * engine and config with those at start, picks which items start and writes a heartbeat and the status file.
 * Runs go side by side, each a thin-path run on its own clone.
 */
export class Worker {
	readonly #o: WorkerOptions;
	readonly #now: () => number;
	readonly #running = new Map<string, Running>();
	readonly #known = new Map<string, Known>();
	/** Items the owner answered that have not started yet; kept across ticks, because the watch token moves on. */
	readonly #answered = new Set<string>();
	readonly #merged: Status["merged"] = [];
	readonly #start: Signature;
	readonly #gate: PrefixGate;
	readonly wake = new Wake();
	#token: string | undefined;
	#restarting: { reason: string; at: number } | undefined;
	readonly #latest: (t: number) => Promise<string | undefined>;
	readonly #ciTick: (t: number) => Promise<number | undefined>;
	/** Ticks that picked: one per tick, whatever number of runs ended since the last. */
	picks = 0;

	constructor(options: WorkerOptions) {
		this.#o = options;
		this.#now = options.now ?? Date.now;
		this.#gate = options.gate ?? new PrefixGate({ now: this.#now });
		this.#latest = throttled(options.latestVersion, LATEST_EVERY_MS);
		this.#ciTick = throttled(options.ciTick, CI_TICK_EVERY_MS);
		this.#start = signatureOf(options.repo, options.engineVersion ?? ENGINE_VERSION);
		rememberKinds(options.state, options.config);
		options.runner.holdUntil(options.state.limit.get("runner")?.until ?? 0);
	}

	/** Items with a run going. */
	running(): string[] {
		return [...this.#running.keys()];
	}

	/** Resolves when no run is going. */
	async idle(): Promise<void> {
		while (this.#running.size > 0) await Promise.all([...this.#running.values()].map((run) => run.done));
	}

	/** The configured kind whose machine has this id, with its name. */
	#kindNamed(machineId: string): { readonly name: string; readonly kind: Kind } | undefined {
		const found = Object.entries(this.#o.config.kinds).find(([, kind]) => kind.machine.id === machineId);

		return found && { name: found[0], kind: found[1] };
	}

	#asleep(saved: SavedSnapshot): boolean {
		const named = this.#kindNamed(saved.kind);

		return named !== undefined && hasTag(named.kind, saved.state, OWNER_WAIT_TAG);
	}

	/** A saved wait whose deadline has passed fires now. The restored machine reschedules its timers from the clock below, and an overdue one fires at once. */
	async #deadlines(t: number): Promise<void> {
		const { state } = this.#o;

		for (const saved of state.items.saved()) {
			const kind = this.#kindNamed(saved.kind)?.kind;
			const delays = Object.keys((saved.state && kind?.machine.states[saved.state]?.after) || {}).map(Number).sort((a, b) => a - b);

			if (!kind || saved.machineVersion !== kind.machine.version || this.#running.has(saved.itemId) || delays.length === 0 || t < saved.savedAt + Math.min(...delays)) continue;

			// The machine reschedules its timers on the wall clock, so the clock below only collects them. The earliest ones, as many as the declared delays say are due by the worker's clock, fire.
			const timers: { fire: () => void; ms: number }[] = [];
			const clock = { setTimeout: (fire: () => void, ms: number) => timers.push({ fire, ms }), clearTimeout: () => {} };
			const restored = await state.items.restore(saved.itemId, kind, { sources: neverSources(kind), clock });

			if (!restored.ok || !restored.value) continue;

			const actor = restored.value;

			actor.start();

			timers.sort((a, b) => a.ms - b.ms).forEach((timer, i) => {
				if (t - saved.savedAt >= (delays[i] ?? Infinity)) timer.fire();
			});

			await new Promise((resolve) => setTimeout(resolve, 0));

			const value = String(actor.getSnapshot().value);

			if (value !== saved.state) {
				state.items.save(saved.itemId, kind, persistedSnapshot(actor));

				if (hasTag(kind, value, STUCK_TAG)) park({ state, now: this.#now }, { outcome: "stuck", item: saved.itemId, detail: `its wait in ${saved.state} timed out` });
			}

			actor.stop();
		}

	}

	/** The item ids the answer hook dropped in the inbox folder. Each file is read once and removed. */
	#inbox(): string[] {
		return listFiles(this.#o.state.inbox).flatMap((file) => {
			try {
				const id = readFileSync(file, "utf8").trim();

				rmSync(file, { force: true });

				return id ? [id] : [];
			} catch {
				return [];
			}
		});
	}

	/** Takes an item the owner acted on back from the parked: its saved state is dropped and its cap starts afresh. */
	#unpark(id: string): void {
		const { state } = this.#o;
		const parked = state.parked.get(id);

		if (!parked) return;

		state.parked.remove(id);
		state.items.remove(id);
		state.faults.clear(`item-${parked.why === "stuck" ? "stuck" : "review"}:${id}`);

		const spent = state.spent.get(id);

		if (spent) state.spent.put(id, { ...spent, base: spent.total });
	}

	/** Reads the threads that can have changed, saves each new answer as an event, and releases a parked item the owner answered. */
	async #answers(sleeping: readonly SavedSnapshot[]): Promise<void> {
		const { state, adapters } = this.#o;
		const inbox = this.#inbox();
		const watched = adapters.answers ? await adapters.answers.watch(this.#token) : { token: "", changed: true };

		this.#token = watched.token;

		if (!watched.changed && inbox.length === 0) return;

		const waiting = new Set(sleeping.map((s) => s.itemId));
		const parked = state.parked.list();

		for (const id of new Set([...waiting, ...parked.map((p) => p.item), ...inbox])) {
			const item = await adapters.workSource.read(id);
			const held = parked.find((p) => p.item === id);

			if (held) {
				if (item.thread.some((e) => e.kind === "answer" && e.at > held.since)) this.#unpark(id);

				continue;
			}

			const answer = waiting.has(id) ? answerTo(item) : undefined;
			const at = item.thread.findLast((e) => e.kind === "answer")?.at;

			if (answer && at !== undefined) {
				state.events.add({ source: "thread", sourceId: `answer:${at}`, itemId: id, type: "answered", payload: {} });
				this.#answered.add(id);
			}
		}
	}

	async #learn(ref: ItemRef): Promise<Known> {
		const known = this.#known.get(ref.id);

		if (known) return known;

		const item = await this.#o.adapters.workSource.read(ref.id);
		const learned = { footprint: footprintOf(item), kind: this.#o.kind(item), title: item.title };

		this.#known.set(ref.id, learned);

		return learned;
	}

	/** Every claim in flight is renewed; a run whose claim is gone stops. */
	async #renew(): Promise<void> {
		const { adapters, holder, claimTtlMs } = this.#o;

		await Promise.all(
			[...this.#running].map(async ([id, run]) => {
				const claim = await adapters.workSource.renew(id, holder, claimTtlMs ?? DEFAULT_CLAIM_TTL_MS).catch(() => undefined);

				if (claim && !claim.won) run.abort.abort();
			}),
		);
	}

	#begin(candidate: Candidate, known: Known, t: number): void {
		const { state, config, adapters } = this.#o;
		const abort = new AbortController();

		const done = runThinPath({
			workSource: adapters.workSource,
			questions: adapters.questions,
			state,
			runner: this.#o.runner,
			config,
			kind: known.kind,
			remote: this.#o.remote,
			base: this.#o.base,
			checks: this.#o.checks,
			holder: this.#o.holder,
			claimTtlMs: this.#o.claimTtlMs,
			workDir: this.#o.workDir,
			dir: this.#o.dir,
			maxFixes: this.#o.maxFixes,
			itemId: candidate.id,
			signal: abort.signal,
			gate: this.#gate,
			now: this.#now,
		}).then(
			(result) => this.#ended(candidate.id, known, result),
			(error: Error) => this.#failed(candidate.id, error),
		);

		this.#running.set(candidate.id, { abort, since: t, title: known.title, done });
	}

	#ended(id: string, known: Known, result: ThinResult): void {
		const { state, runner } = this.#o;

		this.#running.delete(id);

		if (runner.limitedUntil() > this.#now()) state.limit.put("runner", { until: runner.limitedUntil() });

		if (result.outcome === "merged") this.#merged.unshift({ item: id, title: known.title, mergedAt: this.#now() });

		this.#o.onResult?.(result);
		this.wake.signal();
	}

	#failed(id: string, error: Error): void {
		this.#running.delete(id);
		this.#o.state.faults.raise({
			code: "run-error",
			item: id,
			cause: `The run for ${id} failed: ${error.message}`.slice(0, 300),
			fix: "hum tries the item again when its claim lapses; look at the cause if this card stays.",
		});
		this.wake.signal();
	}

	/** The heartbeat and the status file, both by temp file and rename. */
	async #publish(t: number, signature: Signature): Promise<void> {
		const { state, config, where = "mac" } = this.#o;
		const intervalMs = this.#o.intervalMs ?? 30_000;
		const inFlight = [...this.#running.keys()];

		writeHeartbeat(state.heartbeatPath, { time: t, engineVersion: signature.engineVersion, configHash: config.hash, inFlight, intervalMs, restarting: this.#restarting?.reason });

		const read = readStatus(state.statusPath);
		const before = read.ok ? read.status : emptyStatus(signature.engineVersion, t);
		const latest = await this.#latest(t);
		const ci = await this.#ciTick(t);
		const engine: Status["engine"] = { version: signature.engineVersion, adapterApi: ADAPTER_API_VERSION, configSchema: SCHEMA_VERSION };

		if (latest) engine.latest = latest;

		const saved = new Map(state.items.saved().map((s) => [s.itemId, s.state]));

		writeStatus(state.statusPath, {
			...before,
			writtenAt: t,
			workers: { ...before.workers, ci: ci ?? before.workers.ci, [where]: t },
			engine,
			cards: state.faults.list(),
			inFlight: [...this.#running].map(([item, run]) => ({ item, title: run.title, state: saved.get(item) ?? "starting", since: run.since, unclear: false })),
			merged: [...this.#merged.splice(0), ...before.merged].slice(0, 50),
		});
	}

	/** An update is seen when the installed engine, the lockfile, `.hum/` or `adapters/` differ from start. */
	#updated(now: Signature): string | undefined {
		if (now.engineVersion !== this.#start.engineVersion) return `the engine changed from ${this.#start.engineVersion} to ${now.engineVersion}`;

		if (now.hash !== this.#start.hash) return "the lockfile, .hum/ or adapters/ changed";

		return undefined;
	}

	async tick(): Promise<TickResult> {
		const { state, adapters, runner } = this.#o;
		const t = this.#now();

		await this.#deadlines(t);

		if (this.#o.config.hum.ciToken) checkTokenAge(state.faults, this.#o.config.hum.ciToken.setUp, t);

		// One snapshot of the facts: everything below decides from these and from the runs in flight.
		const signature = signatureOf(this.#o.repo, this.#o.engineVersion ?? ENGINE_VERSION);
		const saved = state.items.saved();

		const sleeping = saved.filter((s) => this.#asleep(s));

		const reason = this.#updated(signature);

		if (reason && !this.#restarting) this.#restarting = { reason, at: t };

		await this.#renew();

		if (this.#restarting) {
			if (this.#running.size > 0 && t - this.#restarting.at >= (this.#o.drainMs ?? 5 * 60_000)) for (const run of this.#running.values()) run.abort.abort();

			await this.#publish(t, signature);

			return this.#running.size === 0 ? { kind: "exit", reason: this.#restarting.reason } : { kind: "draining", reason: this.#restarting.reason };
		}

		let ready: ItemRef[] | undefined;

		try {
			await this.#answers(sleeping);
			ready = await adapters.workSource.listReady();
		} catch {
			// The guarded adapter has raised its card; nothing starts on facts this tick could not read.
		}

		const started: string[] = [];

		if (ready) {
			const parked = new Set(state.parked.list().map((p) => p.item));
			const asleep = new Set(sleeping.map((s) => s.itemId));
			const fresh = ready.filter((ref) => !this.#running.has(ref.id) && !parked.has(ref.id) && !asleep.has(ref.id));
			const answered = sleeping.filter((s) => this.#answered.has(s.itemId) && !this.#running.has(s.itemId));
			const queue: Candidate[] = [];
			const knowns = new Map<string, Known>();

			for (const ref of fresh) {
				const known = await this.#learn(ref).catch(() => undefined);

				if (known) {
					knowns.set(ref.id, known);
					queue.push({ id: ref.id, footprint: known.footprint, answered: false });
				}
			}

			for (const s of answered) {
				const known = await this.#learn({ id: s.itemId, title: s.itemId }).catch(() => undefined);
				const named = this.#kindNamed(s.kind);

				if (known && named) {
					knowns.set(s.itemId, { ...known, kind: named.name });
					queue.push({ id: s.itemId, footprint: known.footprint, answered: true });
				}
			}

			this.picks++;

			const picked = pick({
				now: t,
				limitedUntil: runner.limitedUntil(),
				runners: this.#o.runners ?? 3,
				running: [...this.#running.keys()].map((id) => ({ id, footprint: this.#known.get(id)?.footprint })),
				queue,
			});

			for (const candidate of picked.start) {
				const known = knowns.get(candidate.id);

				if (!known) continue;

				this.#answered.delete(candidate.id);
				this.#begin(candidate, known, t);
				started.push(candidate.id);
			}
		}

		await this.#publish(t, signature);

		return { kind: "ran", started };
	}

	/** Ticks until an update is seen and the runs have ended, or `abort` fires. An end of a run, an inbox file or a signal wakes it early. */
	async serve(abort?: AbortSignal): Promise<Extract<TickResult, { kind: "exit" }>> {
		const { state } = this.#o;

		mkdirSync(state.inbox, { recursive: true });

		const inbox = watch(state.inbox, () => this.wake.signal());

		try {
			for (;;) {
				const result = await this.tick();

				if (result.kind === "exit") return result;

				await this.wake.wait(this.#o.intervalMs ?? 30_000, abort);

				if (abort?.aborted) {
					for (const run of this.#running.values()) run.abort.abort();

					await this.idle();

					return { kind: "exit", reason: "stopped" };
				}
			}
		} finally {
			inbox.close();
		}
	}
}
