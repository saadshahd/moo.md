import type { ModelCall } from "../adapters/model-call.ts";
import { mkdirSync, readFileSync, rmSync, watch } from "node:fs";
import ExpiryMap from "expiry-map";
import pMemoize from "p-memoize";
import PQueue from "p-queue";
import pTimeout from "p-timeout";
import { createAsyncLogic } from "xstate";
import { ADAPTER_API_VERSION, type Answers, type Holder, ItemId, type ItemRef, type Questions, type WorkSource } from "../adapter-api.ts";
import type { Runner } from "../adapters/claude-p.ts";
import type { Config } from "../config/load.ts";
import { invokedSources } from "../config/machine.ts";
import { type Kind, SCHEMA_VERSION } from "../config/schema.ts";
import { checkTokenAge } from "../service/token.ts";
import { listFiles } from "../state/fs.ts";
import { ENGINE_VERSION } from "../state/format.ts";
import { persistedSnapshot, type SavedSnapshot } from "../state/items.ts";
import type { State } from "../state/open.ts";
import { tallyOf } from "./tally.ts";
import { checkBaseAfterMerge } from "./base-check.ts";
import { settleMergedPulls } from "./merged.ts";
import { readHistory } from "../adapters/history.ts";
import { gitIn, PATCH } from "../adapters/git.ts";
import { join } from "node:path";
import { configuredModelCall, modelCallOver } from "../adapters/model-call.ts";
import { type MemoryEntry, readMemory, type RefusedLine, unusedEntries, useOf } from "../loop/memory.ts";
import { runLoopPass, type LoopPass } from "../loop/pass.ts";
import { modelProposer, doesTrustRepeats } from "../loop/pair.ts";
import { measureOf } from "../measure/measure.ts";
import { measureInputsOf } from "../measure/inputs.ts";
import { emptyStatus, readStatus, writeHeartbeat, writeStatus } from "../status/file.ts";
import type { Status } from "../status/format.ts";
import { newestChoices, openQuestions } from "../status/sections.ts";
import { commandTimeoutMs } from "../exec.ts";
import { SECOND_MS } from "../time.ts";
import { type Exit, runLifecycle, type TickResult } from "./lifecycle.ts";
import { type Footprint, footprintOf, pick, PrefixGate } from "./scheduler.ts";
import { type Signature, signatureOf } from "./signature.ts";
import type { PullRequests } from "../adapters/pull-requests.ts";
import type { SlotPool } from "../slots/pool.ts";
import { type AnswerScope, settleAnswers } from "./answers.ts";
import { recentlyAsked, releaseQuestions } from "./questions.ts";
import { OWNER_APPROVAL } from "../decide/merge.ts";
import { answerTo, type Checkout, ownerWaitStage, claimTtlMs, DEFAULT_BASE, hasEndedStuck, park, rememberKinds, RUN_AGAIN, runThinPath, type ThinResult, isWaitingOnOwner } from "./thin-path.ts";

export type { TickResult } from "./lifecycle.ts";

/** Where the loop keeps the base it read, so a fetch elsewhere cannot move it mid-pass. */
const LOOP_REF = "refs/hum/loop-base";

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
	/** The cheap model call; by default the config's decision model through the runner. */
	readonly judge?: ModelCall;
	readonly remote: string;
	readonly base?: string;
	readonly checks: readonly string[];
	readonly holder: Holder;
	readonly workDir?: string;
	/** Gives each pass its working copy; by default a `git clone`. */
	readonly checkout?: Checkout;
	/** The run slots behind `checkout`, if any: each tick asks them to keep slots ready. */
	readonly slots?: Pick<SlotPool, "keepReady">;
	readonly dir?: string;
	readonly where?: "mac" | "ci";
	readonly now: () => number;
	/** The names of the variables the runs have, for the missing-secret check. */
	readonly runnerVariables: ReadonlySet<string>;
	/** A fresh id for each run's session. */
	readonly newSessionId: () => string;
	/** The engine this process runs; the update check compares the one installed in `repo` with it. */
	readonly engineVersion?: string;
	/** The newest published version; a failed or slow read shows no version. */
	readonly latestVersion?: () => Promise<string | undefined>;
	/** When the scheduled workflow last ran; a failed or slow read shows no time. */
	readonly ciTick?: () => Promise<number | undefined>;
	readonly gate?: PrefixGate;
	readonly onResult?: (result: ThinResult) => void;
	/** The remote's pull requests and branch rules, for a remote on GitHub. */
	readonly pulls?: PullRequests;
	/** What the review-note loop reads from the review surface and CI; without it the loop reads only git and the owner's answers. */
	readonly loop?: Partial<Pick<LoopPass, "comments" | "ciLogs">>;
};

/** What the tick read of its sources: whether the watch saw a change, and the ready list. */
type Sources = {
	readonly changed: boolean;
	readonly ready: ItemRef[];
};

type Known = {
	readonly footprint: Footprint;
	readonly title: string;
};

type InFlight = {
	readonly abort: AbortController;
	readonly since: number;
	readonly known: Known;
};

const ERROR_EXCERPT = 300;

const UNREAD_CODE = "item-unread";

const linesText = (lines: readonly number[]): string => `${lines.length === 1 ? "line" : "lines"} ${lines.join(", ")}`;

/** The card for each reason memory.md lines are refused. */
const MEMORY_CARDS = {
	"no-source": {
		code: "memory-format",
		cause: (lines: readonly number[]) => `Runs skip memory.md ${linesText(lines)}: no "(source: …)".`,
		fix: "Give the line a source, as in - <rule> (source: <where you said it>).",
	},
	"past-cap": {
		code: "memory-full",
		cause: (lines: readonly number[], maxBytes: number) => `Runs skip memory.md ${linesText(lines)}: past memoryMaxBytes (${maxBytes}).`,
		fix: "Remove entries you no longer need, or raise memoryMaxBytes in .hum/hum.json.",
	},
} as const satisfies Record<RefusedLine["why"], { code: string; cause: (lines: readonly number[], maxBytes: number) => string; fix: string }>;

/** Reads `read` at most once per `everyMs`; a failed read, or one slower than `timeoutMs`, shows no value, and that too is kept for the period. */
const readEvery = <T>(read: (() => Promise<T | undefined>) | undefined, { everyMs, timeoutMs }: { everyMs: number; timeoutMs: number }): (() => Promise<T | undefined>) =>
	read === undefined
		? async () => undefined
		: pMemoize(() => pTimeout(read(), { milliseconds: timeoutMs, fallback: () => undefined }).catch(() => undefined), { cache: new ExpiryMap(everyMs) });

/** Sources that never settle, so a restored item can be stepped by its timers without starting a run. */
const neverSources = (kind: Kind) => invokedSources(kind, createAsyncLogic({ run: () => new Promise<never>(() => {}) }));

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
	#loopAt = Number.NEGATIVE_INFINITY;
	readonly #inFlight = new Map<string, InFlight>();
	/** Items the owner answered that have not started yet; kept across ticks, because the watch token moves on. */
	readonly #answered = new Set<string>();
	/** Saved changes that land again under this worker's config before anything else starts. */
	readonly #relanding = new Set<string>();
	/** Items whose thread a tick failed to read; the next tick reads them again whatever the watch says. */
	readonly #unread = new Set<string>();
	readonly #merged: Status["merged"] = [];
	readonly #wakes = new EventTarget();
	readonly #latest: () => Promise<string | undefined>;
	readonly #ciTick: () => Promise<number | undefined>;
	readonly #judge: ModelCall;
	#watchToken: string | undefined;
	/** Set while the worker has seen an update; no change lands until a worker on the new config takes it. */
	#updating: string | undefined;

	get config(): Config {
		return this.#o.config;
	}

	constructor(options: WorkerOptions) {
		this.#o = options;
		this.#now = options.now;
		this.#gate = options.gate ?? new PrefixGate({ now: this.#now });
		const timeoutMs = options.config.hum.statusReadTimeoutSeconds * SECOND_MS;

		this.#latest = readEvery(options.latestVersion, { everyMs: options.config.hum.latestVersionCacheSeconds * SECOND_MS, timeoutMs });
		this.#ciTick = readEvery(options.ciTick, { everyMs: options.config.hum.ciTickCacheSeconds * SECOND_MS, timeoutMs });
		this.#start = signatureOf({ repo: options.repo, fallbackVersion: options.engineVersion ?? ENGINE_VERSION, itemsDir: options.config.hum.itemsDir });
		this.#judge = options.judge ?? configuredModelCall(options.runner, options.config.hum, (item, tokens) => tallyOf(options.state, item).spend(tokens));
		rememberKinds(options.state, options.config);
		this.#recheckLandings();
	}

	/**
	 * A config can change a saved change's level, so each one lands again at this worker's first tick under the config
	 * it started with, claimed or not: a pull request armed under the old level is disarmed before GitHub merges it.
	 */
	#recheckLandings(): void {
		const { state } = this.#o;

		for (const { item } of state.landings.list()) {
			if (state.parked.get(item)?.why === "review") this.#unpark(item, undefined);

			this.#relanding.add(item);
		}
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

		return kind !== undefined && isWaitingOnOwner(kind, saved.state);
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

			if (hasEndedStuck(kind, value))
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

	/**
	 * Takes an item the owner acted on back from the parked. A finished change keeps its saved landing and lands again,
	 * unless the owner asked to run it again; otherwise its saved state is dropped and its cap starts afresh.
	 */
	#unpark(id: string, option: string | undefined): void {
		const { state } = this.#o;
		const parked = state.parked.get(id);

		if (!parked) return;

		state.parked.remove(id);
		state.faults.clear({ code: `item-${parked.why}`, item: id });

		const landsAgain = state.landings.get(id) !== undefined && option !== RUN_AGAIN;

		if (landsAgain) return;

		state.items.remove(id);
		state.landings.remove(id);

		const spent = state.spent.get(id);

		if (spent) state.spent.put(id, { ...spent, base: spent.total });
	}

	/** Where an item stands when its thread is read, for the disposition of an answer to it. */
	#stageOf(id: string, ready: boolean, sleeping: ReadonlyMap<string, SavedSnapshot>): AnswerScope {
		const parked = this.#o.state.parked.get(id);

		if (this.#inFlight.has(id)) return { stage: "running" };

		if (parked) return { stage: parked.why === "review" ? "approval" : "waiting", options: parked.why === "review" ? [OWNER_APPROVAL, RUN_AGAIN] : [RUN_AGAIN] };

		const asleep = sleeping.get(id);
		const kind = asleep && this.#kindNamed(asleep.kind)?.kind;

		if (asleep && kind) return { stage: ownerWaitStage(kind, asleep.state) };

		return { stage: ready ? "waiting" : "ended" };
	}

	/**
	 * The tick's read of its sources: the watch first, so the ready list read after it holds every change the token
	 * names, then the ready list, whose read every later call of the tick shares. Undefined when a source could not be
	 * read, and its guard has raised the card.
	 */
	async #readSources(): Promise<Sources | undefined> {
		const { adapters } = this.#o;

		try {
			const watched = adapters.answers ? await adapters.answers.watch(this.#watchToken) : { token: "", changed: true };

			this.#watchToken = watched.token;

			return { changed: watched.changed, ready: await adapters.workSource.listReady() };
		} catch {
			return undefined;
		}
	}

	/**
	 * Reads the threads that can have changed, settles each new answer, and releases a parked item the owner answered.
	 * Each item is read on its own: one that fails raises a card naming it and is read again next tick, and the rest go on.
	 */
	async #readAnswers(sleeping: readonly SavedSnapshot[], changed: boolean): Promise<void> {
		const { state, adapters, config } = this.#o;
		const inbox = this.#inbox();

		if (!changed && inbox.length === 0 && this.#unread.size === 0) return;

		const waiting = new Set(sleeping.map((s) => s.itemId));
		const asleep = new Map(sleeping.map((s) => [s.itemId, s]));
		const parked = state.parked.list();
		const asked = recentlyAsked({ state, config, now: this.#now });

		await Promise.all(
			[...new Set([...waiting, ...parked.map((p) => p.item), ...inbox, ...asked, ...this.#unread])].map((id) =>
				this.#readThread(id, async () => {
					const raw = await adapters.workSource.read(ItemId.parse(id));
					const item = await settleAnswers({ state, workSource: adapters.workSource, judge: this.#judge, now: this.#now }, raw, this.#stageOf(id, raw.ready, asleep));
					const held = parked.find((p) => p.item === id);
					const lastAnswer = item.thread.findLast((e) => e.kind === "answer");
					const lastAnswerAt = lastAnswer?.at;

					if (held) {
						if (isAnsweredSince(lastAnswerAt, held.since)) this.#unpark(id, lastAnswer?.option);

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
			),
		);
	}

	/** Runs one item's read; a failure raises the card that names the item, and the item is read again next tick. */
	async #readThread(id: string, read: () => Promise<void>): Promise<void> {
		const { faults } = this.#o.state;

		try {
			await read();
			this.#unread.delete(id);
			faults.clear({ code: UNREAD_CODE, item: id });
		} catch (error) {
			this.#unread.add(id);
			faults.raise({ code: UNREAD_CODE, item: id, cause: `The thread of ${id} could not be read: ${error instanceof Error ? error.message : String(error)}`.slice(0, ERROR_EXCERPT), fix: "hum reads it again each tick and goes on with the other items." });
		}
	}

	/** Every claim in flight is renewed; a run whose claim is gone stops. */
	async #renew(): Promise<void> {
		const { adapters, holder, config } = this.#o;

		await Promise.all(
			[...this.#inFlight].map(async ([id, run]) => {
				const claim = await adapters.workSource.renew(ItemId.parse(id), holder, claimTtlMs(config)).catch(() => undefined);

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
				judge: this.#judge,
				config,
				remote: this.#o.remote,
				base: this.#o.base,
				checks: this.#o.checks,
				holder: this.#o.holder,
				workDir: this.#o.workDir,
				checkout: this.#o.checkout,
				dir: this.#o.dir,
				itemId: ItemId.parse(id),
				signal: abort.signal,
				gate: this.#gate,
				now: this.#now,
				runnerVariables: this.#o.runnerVariables,
				newSessionId: this.#o.newSessionId,
				pulls: this.#o.pulls,
				mayLand: () => this.#updating === undefined,
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

		if (result.outcome === "merged") void this.#pool.add(() => this.#checkBase(id));

		this.#o.onResult?.(result);
		this.wake();
	}

	/** After a merge, the repo's checks run on the base; a failure there files a follow-up and joins the fix limit. */
	async #checkBase(item: string): Promise<void> {
		const { state, config, adapters, repo, remote, base = DEFAULT_BASE, checks } = this.#o;

		await checkBaseAfterMerge({ state, config, workSource: adapters.workSource, git: gitIn(repo, { timeoutMs: commandTimeoutMs(config.hum) }), remote, base, checks, now: this.#now, item }).catch((error: Error) => {
			state.faults.raise({ code: "base-check", item, cause: `The checks on ${base} after ${item} merged did not run: ${error.message}`.slice(0, ERROR_EXCERPT), fix: "hum does not look at that merge again; run the checks on the base yourself." });
		});
	}

	/** The memory.md rules the runs shown the file did not apply in the last `memoryUnusedRuns` of them. */
	#unusedMemory(entries: readonly MemoryEntry[]): string[] {
		const { state, config } = this.#o;
		const { runsSoFar, lastUsed } = useOf(state.runs.all());

		return unusedEntries({ entries, lastUsed, runsSoFar, limit: config.hum.memoryUnusedRuns }).map(({ rule }) => rule);
	}

	/** One card for each reason memory.md lines are refused, naming the lines as they stand; a reason no line has any more clears its card. */
	#showRefusedMemory(refused: readonly RefusedLine[]): void {
		const { faults } = this.#o.state;

		for (const [why, { code, cause, fix }] of Object.entries(MEMORY_CARDS)) {
			const lines = refused.flatMap((line) => (line.why === why ? [line.line] : []));
			const now = lines.length === 0 ? undefined : cause(lines, this.#o.config.hum.memoryMaxBytes);

			if (faults.list().some((card) => card.code === code && card.cause !== now)) faults.clear({ code });

			if (now !== undefined) faults.raise({ code, cause: now, fix });
		}
	}

	/** The review-note loop runs once an interval, off the tick, so a slow model call never holds a tick. */
	#loopIfDue(t: number): void {
		const { state, config } = this.#o;

		if (t - this.#loopAt < config.hum.loopIntervalSeconds * SECOND_MS) return;

		this.#loopAt = t;
		void this.#pool.add(() =>
			this.#runLoop().catch((error: Error) => {
				state.faults.raise({ code: "review-loop", cause: `The review-note loop failed: ${error.message}`.slice(0, ERROR_EXCERPT), fix: "It runs again next interval; look at the cause if this card stays." });
			}),
		);
	}

	async #runLoop(): Promise<void> {
		const { state, config, adapters, repo, remote, base = DEFAULT_BASE, runner, pulls, loop } = this.#o;
		const git = gitIn(repo, { timeoutMs: commandTimeoutMs(config.hum) });
		const call = modelCallOver(runner, { model: config.hum.decisionModel, timeoutMs: config.hum.modelCallTimeoutSeconds * SECOND_MS, trusts: () => true, onSpent: (item, tokens) => tallyOf(state, item).spend(tokens) });

		await git.raw(["fetch", "-q", remote, `+refs/heads/${base}:${LOOP_REF}`]);

		const tip = (await git.raw(["rev-parse", LOOP_REF])).trim();

		if (pulls) await settleMergedPulls(state, pulls, this.#now());

		await runLoopPass({
			state,
			config,
			workSource: adapters.workSource,
			now: this.#now,
			comments: loop?.comments ?? (async () => []),
			ciLogs: loop?.ciLogs ?? (async () => []),
			history: () => readHistory(git, tip, config.hum),
			hunkOf: async (sha, file) => (await git.run(["show", ...PATCH, "-U3", "--format=", sha, ...(file === undefined ? [] : ["--", file])])).stdout,
			propose: modelProposer(call),
			trusts: (models) => doesTrustRepeats(models, config.hum),
			memoryPath: join(repo, ".hum", "memory.md"),
		});
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
		const memory = readMemory(join(this.#o.repo, ".hum", "memory.md"), config.hum.memoryMaxBytes);

		this.#showRefusedMemory(memory.refused);
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
			questions: openQuestions(state.questions.list(), state.answers.list()),
			choices: newestChoices(state.choices.list(), config.hum.choicesShown),
			cards: state.faults.list(),
			inFlight: [...this.#inFlight].map(([item, run]) => ({
				item,
				title: run.known.title,
				state: saved.get(item) ?? "starting",
				since: run.since,
				unclear: false,
			})),
			merged: [...this.#merged.splice(0), ...before.merged].slice(0, this.#o.config.hum.mergedShown),
			possibleRepeats: state.possibleRepeats.list().map(({ a, b }) => ({ a, b })),
			unusedMemory: this.#unusedMemory(memory.entries),
			measure: measureOf({ ...measureInputsOf(state), window: config.hum.measureWindow, globs: config.hum.paths.map(({ glob }) => glob) }) ?? null,
			rules: state.learned.list().map(({ glob, level, item, at, commit }) => ({ glob, level, item, at, undo: { label: "Undo", command: `git revert ${commit}` } })),
		});
	}

	/** Why the worker must restart: the installed engine, the lockfile, `.hum/` or `adapters/` differ from those at start. */
	#updateSeen(now: Signature): string | undefined {
		if (now.engineVersion !== this.#start.engineVersion) return `the engine changed from ${this.#start.engineVersion} to ${now.engineVersion}`;

		if (now.hash !== this.#start.hash) return "the lockfile, .hum/ or adapters/ changed";

		return undefined;
	}

	/** The ready list, once the threads that changed were read; undefined when a source could not be read, and its guard has raised the card. */
	async #readReady(sources: Sources | undefined, sleeping: readonly SavedSnapshot[]): Promise<ItemRef[] | undefined> {
		if (sources === undefined) return undefined;

		try {
			await this.#readAnswers(sleeping, sources.changed);

			return sources.ready;
		} catch {
			return undefined;
		}
	}

	/** What the scheduler needs of an item, read fresh each tick so an owner's edit to its `touches:` counts. */
	async #learn(id: string): Promise<Known> {
		const item = await this.#o.adapters.workSource.read(ItemId.parse(id));

		return { footprint: footprintOf(item), title: item.title };
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

		const relands = [...this.#relanding].flatMap((id) => (isFresh(id) && !ready.some((ref) => ref.id === id) ? [learned(id).then((known) => ({ id, answered: true, known }))] : []));

		const waiting = (await Promise.all([...fresh, ...answered, ...relands])).flatMap(({ id, answered, known }) => (known ? [{ id, answered, known }] : []));
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
			this.#relanding.delete(id);
			this.#begin(id, known, t);

			return [id];
		});
	}

	async tick(): Promise<TickResult> {
		const { state, config } = this.#o;
		const t = this.#now();

		await Promise.all(this.#dueWaits(t).map((due) => this.#fireDue(due, t)));

		if (config.hum.ciToken) checkTokenAge(state.faults, { setUp: config.hum.ciToken.setUp, now: t, warnDays: config.hum.tokenWarnDays });

		const signature = signatureOf({ repo: this.#o.repo, fallbackVersion: this.#o.engineVersion ?? ENGINE_VERSION, itemsDir: this.#o.config.hum.itemsDir });
		const update = this.#updateSeen(signature);

		this.#updating = update;
		const sleeping = state.items.saved().filter((s) => this.#isAsleep(s));

		await this.#renew();

		this.#o.slots?.keepReady();

		if (update !== undefined) {
			await this.#publish(t, signature, update);

			return this.#inFlight.size === 0 ? { kind: "exit", reason: update } : { kind: "draining", reason: update };
		}

		const sources = await this.#readSources();

		await releaseQuestions({ state, config, workSource: this.#o.adapters.workSource, questions: this.#o.adapters.questions, now: this.#now }).catch((error: Error) => {
			state.faults.raise({ code: "question-release", cause: `Queued questions could not be asked: ${error.message}`.slice(0, ERROR_EXCERPT), fix: "hum asks them again on the next tick." });
		});

		this.#loopIfDue(t);

		const ready = await this.#readReady(sources, sleeping);
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
