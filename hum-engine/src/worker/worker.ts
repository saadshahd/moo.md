import { mkdirSync, readFileSync, rmSync, watch } from "node:fs";
import ExpiryMap from "expiry-map";
import pMemoize from "p-memoize";
import PQueue from "p-queue";
import pTimeout from "p-timeout";
import { createAsyncLogic } from "xstate";
import { ADAPTER_API_VERSION, type Answers, type Item, type ItemRef, type Questions, type WorkSource } from "../adapter-api.ts";
import type { Runner } from "../adapters/claude-p.ts";
import type { Config } from "../config/load.ts";
import { type Kind, SCHEMA_VERSION } from "../config/schema.ts";
import { checkTokenAge } from "../service/token.ts";
import { listFiles } from "../state/fs.ts";
import { ENGINE_VERSION } from "../state/format.ts";
import { persistedSnapshot, type SavedSnapshot } from "../state/items.ts";
import type { State } from "../state/open.ts";
import { readStatus, writeHeartbeat, writeStatus } from "../status/file.ts";
import { emptyStatus, type Status } from "../status/format.ts";
import { type Exit, runLifecycle, type TickResult } from "./lifecycle.ts";
import { type Footprint, footprintOf, pick, PrefixGate } from "./scheduler.ts";
import { type Signature, signatureOf } from "./signature.ts";
import { answerTo, claimTtlMs, endedStuck, park, rememberKinds, runThinPath, type ThinResult, waitsOnOwner } from "./thin-path.ts";

export type { TickResult } from "./lifecycle.ts";

export type WorkerOptions = {
	/** The owner's checkout: its lockfile, `.hum/` and `adapters/` are what the update check watches. */
	readonly repo: string;
	readonly state: State;
	readonly config: Config;
	readonly adapters: {
		readonly workSource: WorkSource;
		readonly questions: Questions;
		readonly answers?: Answers;
	};
	readonly runner: Runner;
	readonly kind: (item: Item) => string;
	readonly remote: string;
	readonly base?: string;
	readonly checks: readonly string[];
	readonly holder: string;
	readonly workDir?: string;
	readonly dir?: string;
	readonly where?: "mac" | "ci";
	readonly now?: () => number;
	/** The engine this process runs; the update check compares the one installed in `repo` with it. */
	readonly engineVersion?: string;
	/** The newest published version; a failed or slow read shows no version. */
	readonly latestVersion?: () => Promise<string | undefined>;
	/** When the scheduled workflow last ran; a failed or slow read shows no time. */
	readonly ciTick?: () => Promise<number | undefined>;
	readonly gate?: PrefixGate;
	readonly onResult?: (result: ThinResult) => void;
};

type Known = {
	readonly footprint: Footprint;
	readonly kind: string;
	readonly title: string;
};

type InFlight = {
	readonly abort: AbortController;
	readonly since: number;
	readonly known: Known;
};

const SECOND_MS = 1000;

/** A status read that takes longer shows no value, so a hung read never holds a tick. */
const STATUS_READ_TIMEOUT_MS = 10 * SECOND_MS;

const MERGED_SHOWN = 50;

const ERROR_EXCERPT = 300;

/** Reads `read` at most once per `everyMs`; a failed or slow read shows no value, and that too is kept for the period. */
const readEvery = <T>(read: (() => Promise<T | undefined>) | undefined, everyMs: number): (() => Promise<T | undefined>) =>
	read === undefined
		? async () => undefined
		: pMemoize(() => pTimeout(read(), { milliseconds: STATUS_READ_TIMEOUT_MS, fallback: () => undefined }).catch(() => undefined), { cache: new ExpiryMap(everyMs) });

/** Sources that never settle, so a restored item can be stepped by its timers without starting a run. */
const neverSources = (kind: Kind) =>
	Object.fromEntries(Object.values(kind.machine.states).flatMap((node) => (node.invoke ? [[node.invoke.src, createAsyncLogic({ run: () => new Promise<never>(() => {}) })]] : [])));

/** The declared delays of the state an item was saved in, shortest first. */
const delaysOf = (kind: Kind, saved: SavedSnapshot): number[] =>
	Object.keys((saved.state && kind.machine.states[saved.state]?.after) || {})
		.map(Number)
		.sort((a, b) => a - b);

const isAnsweredSince = (answeredAt: number | undefined, since: number): boolean => answeredAt !== undefined && answeredAt > since;

type DueWait = {
	readonly saved: SavedSnapshot;
	readonly kind: Kind;
	readonly delays: readonly number[];
};

const isDue = ({ saved, kind, delays }: DueWait, t: number): boolean =>
	saved.machineVersion === kind.machine.version && delays.length > 0 && t >= saved.savedAt + Math.min(...delays);

/**
 * The worker. Each tick reads its facts once, then decides: it fires waits whose deadline has passed, renews claims,
 * compares the engine and config with those at start, picks which items start, and writes a heartbeat and the status
 * file. Runs go side by side, each a thin-path run on its own clone.
 */
export class Worker {
	readonly #o: WorkerOptions;
	readonly #now: () => number;
	readonly #start: Signature;
	readonly #gate: PrefixGate;
	readonly #pool = new PQueue();
	readonly #inFlight = new Map<string, InFlight>();
	/** Items the owner answered that have not started yet; kept across ticks, because the watch token moves on. */
	readonly #answered = new Set<string>();
	readonly #merged: Status["merged"] = [];
	readonly #wakes = new EventTarget();
	readonly #latest: () => Promise<string | undefined>;
	readonly #ciTick: () => Promise<number | undefined>;
	readonly #learn: (id: string) => Promise<Known>;
	#watchToken: string | undefined;

	get config(): Config {
		return this.#o.config;
	}

	constructor(options: WorkerOptions) {
		this.#o = options;
		this.#now = options.now ?? Date.now;
		this.#gate = options.gate ?? new PrefixGate({ now: this.#now });
		this.#latest = readEvery(options.latestVersion, options.config.hum.latestVersionCacheSeconds * SECOND_MS);
		this.#ciTick = readEvery(options.ciTick, options.config.hum.ciTickCacheSeconds * SECOND_MS);
		this.#start = signatureOf(options.repo, options.engineVersion ?? ENGINE_VERSION, options.config.hum.itemsDir);
		this.#learn = pMemoize(async (id: string): Promise<Known> => {
			const item = await options.adapters.workSource.read(id);

			return {
				footprint: footprintOf(item),
				kind: options.kind(item),
				title: item.title,
			};
		});
		rememberKinds(options.state, options.config);
	}

	running(): string[] {
		return [...this.#inFlight.keys()];
	}

	idle(): Promise<void> {
		return this.#pool.onIdle();
	}

	/** Asks a serving worker for a tick now: a run ended, or an answer arrived. */
	wake(): void {
		this.#wakes.dispatchEvent(new Event("wake"));
	}

	#kindNamed(machineId: string): { readonly name: string; readonly kind: Kind } | undefined {
		const found = Object.entries(this.#o.config.kinds).find(([, kind]) => kind.machine.id === machineId);

		return found && { name: found[0], kind: found[1] };
	}

	/** Whether the item waits on the owner in its saved state. */
	#isAsleep(saved: SavedSnapshot): boolean {
		const kind = this.#kindNamed(saved.kind)?.kind;

		return kind !== undefined && waitsOnOwner(kind, saved.state);
	}

	#dueWaits(t: number): DueWait[] {
		const waits = this.#o.state.items.saved().flatMap((saved) => {
			const kind = this.#kindNamed(saved.kind)?.kind;

			return kind && !this.#inFlight.has(saved.itemId) ? [{ saved, kind, delays: delaysOf(kind, saved) }] : [];
		});

		return waits.filter((wait) => isDue(wait, t));
	}

	/**
	 * A saved wait whose deadline has passed fires now. The restored machine schedules its timers on the wall clock, so
	 * the clock given here only collects them, and the earliest ones, as many as the declared delays say are due by the
	 * worker's clock, fire.
	 */
	async #fireDue({ saved, kind, delays }: DueWait, t: number): Promise<void> {
		const { state } = this.#o;
		const timers: { fire: () => void; ms: number }[] = [];
		const clock = { setTimeout: (fire: () => void, ms: number) => timers.push({ fire, ms }), clearTimeout: () => {} };
		const restored = await state.items.restore(saved.itemId, kind, { sources: neverSources(kind), clock });

		if (!restored.ok || !restored.value) return;

		const actor = restored.value;

		actor.start();

		const dueCount = delays.filter((delay) => t - saved.savedAt >= delay).length;

		for (const timer of timers.sort((a, b) => a.ms - b.ms).slice(0, dueCount)) timer.fire();

		await Bun.sleep(0);

		const value = String(actor.getSnapshot().value);

		if (value !== saved.state) {
			state.items.save(saved.itemId, kind, persistedSnapshot(actor));

			if (endedStuck(kind, value))
				park(
					{ state, now: this.#now },
					{
						outcome: "stuck",
						item: saved.itemId,
						detail: `its wait in ${saved.state} timed out`,
					},
				);
		}

		actor.stop();
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
		state.faults.clear(`item-${parked.why}:${id}`);

		const spent = state.spent.get(id);

		if (spent) state.spent.put(id, { ...spent, base: spent.total });
	}

	/** Reads the threads that can have changed, saves each new answer as an event, and releases a parked item the owner answered. */
	async #readAnswers(sleeping: readonly SavedSnapshot[]): Promise<void> {
		const { state, adapters } = this.#o;
		const inbox = this.#inbox();
		const watched = adapters.answers ? await adapters.answers.watch(this.#watchToken) : { token: "", changed: true };

		this.#watchToken = watched.token;

		if (!watched.changed && inbox.length === 0) return;

		const waiting = new Set(sleeping.map((s) => s.itemId));
		const parked = state.parked.list();

		await Promise.all(
			[...new Set([...waiting, ...parked.map((p) => p.item), ...inbox])].map(async (id) => {
				const item = await adapters.workSource.read(id);
				const held = parked.find((p) => p.item === id);
				const lastAnswerAt = item.thread.findLast((e) => e.kind === "answer")?.at;

				if (held) {
					if (isAnsweredSince(lastAnswerAt, held.since)) this.#unpark(id);

					return;
				}

				const hasNewAnswer = waiting.has(id) && answerTo(item) !== undefined && lastAnswerAt !== undefined;

				if (hasNewAnswer) {
					state.events.add({
						source: "thread",
						sourceId: `answer:${lastAnswerAt}`,
						itemId: id,
						type: "answered",
						payload: {},
					});
					this.#answered.add(id);
				}
			}),
		);
	}

	/** Every claim in flight is renewed; a run whose claim is gone stops. */
	async #renew(): Promise<void> {
		const { adapters, holder, config } = this.#o;

		await Promise.all(
			[...this.#inFlight].map(async ([id, run]) => {
				const claim = await adapters.workSource.renew(id, holder, claimTtlMs(config)).catch(() => undefined);

				if (claim?.won === false) run.abort.abort();
			}),
		);
	}

	#begin(id: string, known: Known, t: number): void {
		const { state, config, adapters } = this.#o;
		const abort = new AbortController();

		this.#inFlight.set(id, { abort, since: t, known });
		void this.#pool.add(() =>
			runThinPath({
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
				workDir: this.#o.workDir,
				dir: this.#o.dir,
				itemId: id,
				signal: abort.signal,
				gate: this.#gate,
				now: this.#now,
			}).then(
				(result) => this.#ended(id, known, result),
				(error: Error) => this.#failed(id, error),
			),
		);
	}

	#ended(id: string, known: Known, result: ThinResult): void {
		this.#inFlight.delete(id);

		if (result.outcome === "merged")
			this.#merged.unshift({
				item: id,
				title: known.title,
				mergedAt: this.#now(),
			});

		this.#o.onResult?.(result);
		this.wake();
	}

	#failed(id: string, error: Error): void {
		this.#inFlight.delete(id);
		this.#o.state.faults.raise({
			code: "run-error",
			item: id,
			cause: `The run for ${id} failed: ${error.message}`.slice(0, ERROR_EXCERPT),
			fix: "hum tries the item again when its claim lapses; look at the cause if this card stays.",
		});
		this.wake();
	}

	async #stopRuns(): Promise<void> {
		for (const run of this.#inFlight.values()) run.abort.abort();

		await this.idle();
	}

	/** The heartbeat and the status file, both by temp file and rename. */
	async #publish(t: number, signature: Signature, restarting: string | undefined): Promise<void> {
		const { state, config, where = "mac" } = this.#o;

		writeHeartbeat(state.heartbeatPath, {
			time: t,
			engineVersion: signature.engineVersion,
			configHash: config.hash,
			inFlight: this.running(),
			intervalMs: config.hum.tickIntervalSeconds * SECOND_MS,
			restarting,
		});

		const read = readStatus(state.statusPath);
		const before = read.ok ? read.status : emptyStatus(signature.engineVersion, t);
		const [latest, ci] = await Promise.all([this.#latest(), this.#ciTick()]);
		const saved = new Map(state.items.saved().map((s) => [s.itemId, s.state]));

		writeStatus(state.statusPath, {
			...before,
			writtenAt: t,
			workers: { ...before.workers, ci: ci ?? before.workers.ci, [where]: t },
			engine: {
				version: signature.engineVersion,
				adapterApi: ADAPTER_API_VERSION,
				configSchema: SCHEMA_VERSION,
				latest,
			},
			cards: state.faults.list(),
			inFlight: [...this.#inFlight].map(([item, run]) => ({
				item,
				title: run.known.title,
				state: saved.get(item) ?? "starting",
				since: run.since,
				unclear: false,
			})),
			merged: [...this.#merged.splice(0), ...before.merged].slice(0, MERGED_SHOWN),
		});
	}

	/** Why the worker must restart: the installed engine, the lockfile, `.hum/` or `adapters/` differ from those at start. */
	#updateSeen(now: Signature): string | undefined {
		if (now.engineVersion !== this.#start.engineVersion) return `the engine changed from ${this.#start.engineVersion} to ${now.engineVersion}`;

		if (now.hash !== this.#start.hash) return "the lockfile, .hum/ or adapters/ changed";

		return undefined;
	}

	/** The ready list, after the threads that changed were read; undefined when the provider could not be read, and its guard has raised the card. */
	async #readReady(sleeping: readonly SavedSnapshot[]): Promise<ItemRef[] | undefined> {
		try {
			await this.#readAnswers(sleeping);

			return await this.#o.adapters.workSource.listReady();
		} catch {
			return undefined;
		}
	}

	/** Which waiting items start now, by the scheduler's rules, and starts them. */
	async #startPicked(t: number, ready: readonly ItemRef[], sleeping: readonly SavedSnapshot[]): Promise<string[]> {
		const { state, runner, config } = this.#o;
		const parked = new Set(state.parked.list().map((p) => p.item));
		const asleep = new Set(sleeping.map((s) => s.itemId));
		const isFresh = (id: string) => !this.#inFlight.has(id) && !parked.has(id) && !asleep.has(id);
		const isAnsweredAndIdle = (id: string) => this.#answered.has(id) && !this.#inFlight.has(id);
		const learned = (id: string) => this.#learn(id).catch(() => undefined);

		const fresh = ready.flatMap((ref) => (isFresh(ref.id) ? [learned(ref.id).then((known) => ({ id: ref.id, answered: false, known }))] : []));

		const answered = sleeping.flatMap((s) => {
			const named = this.#kindNamed(s.kind);

			return isAnsweredAndIdle(s.itemId) ? [learned(s.itemId).then((known) => ({ id: s.itemId, answered: true, known: known && named && { ...known, kind: named.name } }))] : [];
		});

		const waiting = (await Promise.all([...fresh, ...answered])).flatMap(({ id, answered, known }) => (known ? [{ id, answered, known }] : []));
		const knownOf = new Map(waiting.map((w) => [w.id, w.known]));

		const { start } = pick({
			now: t,
			limitedUntil: runner.limitedUntil(),
			runners: config.hum.runners,
			running: [...this.#inFlight].map(([id, run]) => ({
				id,
				footprint: run.known.footprint,
			})),
			queue: waiting.map(({ id, answered, known }) => ({
				id,
				answered,
				footprint: known.footprint,
			})),
		});

		return start.flatMap(({ id }) => {
			const known = knownOf.get(id);

			if (!known) return [];

			this.#answered.delete(id);
			this.#begin(id, known, t);

			return [id];
		});
	}

	async tick(): Promise<TickResult> {
		const { state, config } = this.#o;
		const t = this.#now();

		await Promise.all(this.#dueWaits(t).map((due) => this.#fireDue(due, t)));

		if (config.hum.ciToken) checkTokenAge(state.faults, config.hum.ciToken.setUp, t, config.hum.tokenWarnDays);

		const signature = signatureOf(this.#o.repo, this.#o.engineVersion ?? ENGINE_VERSION, this.#o.config.hum.itemsDir);
		const update = this.#updateSeen(signature);
		const sleeping = state.items.saved().filter((s) => this.#isAsleep(s));

		await this.#renew();

		if (update !== undefined) {
			await this.#publish(t, signature, update);

			return this.#inFlight.size === 0 ? { kind: "exit", reason: update } : { kind: "draining", reason: update };
		}

		const ready = await this.#readReady(sleeping);
		const started = ready ? await this.#startPicked(t, ready, sleeping) : [];

		await this.#publish(t, signature, undefined);

		return { kind: "ran", started };
	}

	/** Ticks until an update is seen and the runs have ended, or `stop` fires. An end of a run, an inbox file or `wake` brings the next tick forward. */
	async serve(stop?: AbortSignal): Promise<Exit> {
		const { state, config } = this.#o;

		mkdirSync(state.inbox, { recursive: true });

		const life = runLifecycle(
			{
				tick: () => this.tick(),
				stopRuns: () => this.#stopRuns(),
				tickIntervalMs: config.hum.tickIntervalSeconds * SECOND_MS,
				drainTimeoutMs: config.hum.drainTimeoutSeconds * SECOND_MS,
			},
			stop,
		);

		const wake = () => life.wake();
		const inbox = watch(state.inbox, () => this.wake());

		this.#wakes.addEventListener("wake", wake);

		try {
			return await life.ended;
		} finally {
			inbox.close();
			this.#wakes.removeEventListener("wake", wake);
		}
	}
}
