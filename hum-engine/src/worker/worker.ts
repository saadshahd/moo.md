import type { ModelCall } from "../adapters/model-call.ts";
import { mkdirSync, readFileSync, rmSync, watch } from "node:fs";
import ExpiryMap from "expiry-map";
import pMemoize from "p-memoize";
import PQueue from "p-queue";
import pTimeout from "p-timeout";
import { createAsyncLogic } from "xstate";
import { ADAPTER_API_VERSION, type Answers, type Holder, type Item, ItemGone, ItemId, type ItemRef, type Questions, type ThreadEntry, type WorkSource } from "../adapter-api.ts";
import type { Runner } from "../adapters/claude-p.ts";
import type { Config } from "../config/load.ts";
import { invokedSources, isWaitingOnOwner } from "../config/machine.ts";
import { type Kind, SCHEMA_VERSION } from "../config/schema.ts";
import { checkTokenAge } from "../service/token.ts";
import { listFiles } from "../state/fs.ts";
import { ENGINE_VERSION } from "../state/format.ts";
import { passedOnto, persistedSnapshot, type SavedSnapshot } from "../state/items.ts";
import type { State } from "../state/open.ts";
import { tallyOf } from "./tally.ts";
import { dueClock, isDue, type SavedWait } from "./due.ts";
import { checkBaseAfterMerge } from "./base-check.ts";
import { settleMergedPulls } from "./merged.ts";
import type { GitHubCommits } from "../adapters/github-commits.ts";
import { readHistory } from "../adapters/history.ts";
import { gitIn, PATCH } from "../adapters/git.ts";
import { join } from "node:path";
import { configuredModelCall, modelCallOver } from "../adapters/model-call.ts";
import { type MemoryEntry, readMemory, type RefusedLine, unusedEntries, useOf } from "../loop/memory.ts";
import { runLoopPass, type LoopPass } from "../loop/pass.ts";
import { modelProposer, doesTrustRepeats } from "../loop/pair.ts";
import { measureOf } from "../measure/measure.ts";
import { measureInputsOf } from "../measure/inputs.ts";
import { keepMergedCases } from "../measure/cases.ts";
import { type StaleScore, staleScores } from "../measure/judges.ts";
import type { Measured, Measurement } from "../measure/remeasure.ts";
import { emptyStatus, readStatus, writeHeartbeat, writeStatus } from "../status/file.ts";
import { type Flow, type FlowAt, flowOf } from "../status/flow.ts";
import type { Choice, ItemLinks, OpenItem, Status } from "../status/format.ts";
import { newestChoices, openQuestions } from "../status/sections.ts";
import { commandTimeoutMs } from "../exec.ts";
import { SECOND_MS } from "../time.ts";
import { type Exit, runLifecycle, type TickResult } from "./lifecycle.ts";
import { type Footprint, footprintOf, pick, PrefixGate, undeclaredFootprint } from "./scheduler.ts";
import { type Signature, signatureOf } from "./signature.ts";
import { adoptEngine, bumpEngine, type EngineHome, engineStep } from "./engine-update.ts";
import type { PullRequests } from "../adapters/pull-requests.ts";
import type { SlotPool } from "../slots/pool.ts";
import { type AnswerScope, settleAnswers } from "./answers.ts";
import { PARK_OPTIONS, RUN_AGAIN } from "../decide/answer.ts";
import { queueQuestion, recentlyAsked, releaseQuestions } from "./questions.ts";
import type { Parked } from "../state/saved.ts";
import { answerTo, type Checkout, doesStartOver, ownerWaitStage, claimTtlMs, DEFAULT_BASE, gatherItem, hasEndedStuck, isGathered, isTalking, park, parkQuestion, rememberKinds, runThinPath, type TalkCopy, talkWaits, type ThinPathOptions, type ThinResult } from "./thin-path.ts";
import { ownerAnswered } from "../state/item-log.ts";
import { forgetItem, hasProgress } from "./kind.ts";
import { dropReviews } from "./owner-handoff.ts";

export type { TickResult } from "./lifecycle.ts";

/** The card on an item someone else already works on. */
export const CLAIMED_CODE = "item-claimed";

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
		/** Ends what the integrations hold open; whoever opened them calls it once done with them. */
		readonly close?: () => Promise<void>;
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
	/** Gives each run the owner talks to a talk copy of its own; where runs are Rail rows, the run slots give it. */
	readonly talkCopy?: TalkCopy;
	/** The run slots behind `checkout`, if any: each tick asks them to keep slots ready, and the worker is idle once their upkeep ends. */
	readonly slots?: Pick<SlotPool, "keepReady" | "idle">;
	readonly dir?: string;
	readonly where?: "mac" | "ci";
	readonly now: () => number;
	/** The names of the variables the runs have, for the missing-secret check. */
	readonly runnerVariables: ReadonlySet<string>;
	/** A fresh id for each run's session. */
	readonly newSessionId: () => string;
	/** The engine this process runs, which the heartbeat and status report and the update check compares the installed one with; where `repo` installs none, it counts as installed. */
	readonly engineVersion?: string;
	/** The newest published version; a failed or slow read shows no version. */
	readonly latestVersion?: () => Promise<string | undefined>;
	/** When the scheduled workflow last ran; a failed or slow read shows no time. */
	readonly ciTick?: () => Promise<number | undefined>;
	readonly gate?: PrefixGate;
	readonly onResult?: (result: ThinResult) => void;
	/** The remote's pull requests and branch rules, for a remote on GitHub. */
	readonly pulls?: PullRequests;
	/** The remote's branches through GitHub's API, which signs the commits it makes, for a remote on GitHub. */
	readonly commits?: GitHubCommits;
	/** What the review-note loop reads from the review surface and CI; without it the loop reads only git and the owner's answers. */
	readonly loop?: Partial<Pick<LoopPass, "comments" | "ciLogs">>;
	/** The CI job this worker is, where a wake splits into jobs; unset, a tick does all a wake does. */
	readonly ciJob?: CiJob;
	/** Measures a model again on the owner's judges, writing its new scores in `.hum/hum.json`; absent where that file is thrown away, as in CI. */
	readonly remeasure?: (measurement: Measurement, signal: AbortSignal) => Promise<Measured>;
};

/**
 * A wake's job that holds a token, `gather`, claims each item and settles its answers and kind, keeps it in `gathered`
 * and runs nothing. The job that holds none, `work`, reads only the threads of the items gather `claimed`, runs each
 * pass, as the base `signs` commits or not, and hands its outbox to `publish`; it asks, files and posts nothing itself.
 * Either takes each item once.
 */
export type CiJob =
	| { readonly kind: "gather"; readonly gathered: Map<string, Item> }
	| { readonly kind: "work"; readonly claimed: ReadonlySet<string>; readonly signs: boolean; readonly publish: NonNullable<ThinPathOptions["publish"]> };

/** What the tick read of its sources: whether the watch saw a change, and the ready list. */
type Sources = {
	readonly changed: boolean;
	readonly ready: ItemRef[];
};

type Known = {
	readonly footprint: Footprint;
	readonly title: string;
	/** Who else already works on the item, as its source names them. */
	readonly claimedBy: readonly string[];
};

type InFlight = {
	readonly abort: AbortController;
	readonly since: number;
	readonly known: Known;
};

const ERROR_EXCERPT = 300;

/** The card for a thread a tick could not read. */
export const UNREAD_CODE = "item-unread";

/** The card for a review-note loop pass that failed. */
const LOOP_CODE = "review-loop";

/** The card for queued questions a tick could not ask. */
const RELEASE_CODE = "question-release";

/** The card for an item's pass that threw. */
const RUN_ERROR_CODE = "run-error";

/** The card for an item that left its source while hum could not stop its runs. */
const END_CODE = "item-end";

/** Runs one step of a longer job; a failure names the step it failed in. */
const during = async <T>(step: string, run: () => Promise<T>): Promise<T> => {
	try {
		return await run();
	} catch (error) {
		throw new Error(`${step}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
	}
};

/** The card for scores that gate on a judge that changed since they were measured. */
const JUDGE_CODE = "judge-changed";

/** The card for an engine update that waits on the owner or failed. */
const ENGINE_CODE = "engine-update";

/** The card for an open item whose feed row the runner could not start. */
export const FEEDS_CODE = "item-feeds";

/** The card for a read of where the owner opens each item that failed, so the status shows no links until one goes through. */
export const LINKS_CODE = "item-links";

const staleText = (stale: readonly StaleScore[]): string => stale.map(({ boundary, model, score }) => `${boundary} on ${model} at ${score.rate.toFixed(2)}`).join(", ");

/** The stale scores, one measurement per model, of the boundaries whose judge changed for it. */
const byModel = (stale: readonly StaleScore[]): { readonly model: string; readonly boundaries: StaleScore["boundary"][] }[] =>
	[...new Set(stale.map(({ model }) => model))].map((model) => ({ model, boundaries: stale.flatMap((found) => (found.model === model ? [found.boundary] : [])) }));

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

const isAnsweredSince = (answeredAt: number | undefined, since: number): boolean => answeredAt !== undefined && answeredAt > since;

/**
 * The worker. Each tick reads its facts once, then decides: it fires waits whose deadline has passed, renews claims,
 * compares the engine and config with those at start, picks which items start, and writes a heartbeat and the status
 * file. Runs go side by side, each a thin-path run on its own clone.
 */
export class Worker {
	readonly #o: WorkerOptions;
	readonly #now: () => number;
	readonly #start: Signature;
	readonly #version: string;
	readonly #gate: PrefixGate;
	readonly #pool = new PQueue();
	#loopAt = Number.NEGATIVE_INFINITY;
	readonly #inFlight = new Map<string, InFlight>();
	/** Each item's title, as the worker last read it. */
	readonly #titles = new Map<string, string>();
	/** The flow of each kind an open item runs, by `<machine id>@<version>`, its graph read once. */
	readonly #flows = new Map<string, Flow>();
	/** Items the owner answered that have not started yet; kept across ticks, because the watch token moves on. */
	readonly #answered = new Set<string>();
	/** Items whose owner wait timed out into work: a pass restores each wait and fires its timeout. */
	readonly #timedOut = new Set<string>();
	/**
	 * Items this worker goes on with at its next tick, past its own standing claim, before anything else starts: a saved
	 * change that lands again under this worker's config, an item that starts over, and on the Mac each item its holder
	 * claimed before this worker started.
	 */
	readonly #resuming = new Set<string>();
	/** Whether this worker has read the items its holder claimed before it started. */
	#tookBack = false;
	/** The items a CI job's passes ended on: each job takes an item once, and the next wake takes it again. */
	readonly #handled = new Set<string>();
	/** Items whose thread a tick failed to read; the next tick reads them again whatever the watch says. */
	readonly #unread = new Set<string>();
	readonly #merged: Status["merged"] = [];
	readonly #wakes = new EventTarget();
	/** Aborted once the worker stops its work: nothing new starts beside the tick after it, and every pass in flight stops. */
	readonly #halt = new AbortController();
	readonly #latest: () => Promise<string | undefined>;
	readonly #ciTick: () => Promise<number | undefined>;
	readonly #judge: ModelCall;
	#watchToken: string | undefined;
	/** Set while the worker has seen an update; no change lands until a worker on the new config takes it. */
	#updating: string | undefined;
	/** The scores that gate on a judge that changed since they were measured: the config is the worker's for its life. */
	readonly #stale: readonly StaleScore[];
	/** Whether a measurement of changed judges runs. */
	#measuring = false;
	#remeasureAt = Number.NEGATIVE_INFINITY;
	#engineAt = Number.NEGATIVE_INFINITY;
	/** Whether a pin of a newer engine is being made on the base. */
	#bumping = false;
	/** The engine the base pins, and the base's commit, which the checkout takes once the runs end. */
	#adopting: { readonly version: string; readonly base: string } | undefined;

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
		this.#version = options.engineVersion ?? ENGINE_VERSION;
		this.#start = signatureOf({ repo: options.repo, fallbackVersion: this.#version, itemsDir: options.config.hum.itemsDir });
		this.#stale = staleScores(options.config);
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

			this.#resuming.add(item);
		}
	}

	running(): string[] {
		return [...this.#inFlight.keys()];
	}

	/** Resolves when no tick or pass runs and no slot upkeep is left: a returned slot is ready again. */
	async idle(): Promise<void> {
		await this.#pool.onIdle();
		await this.#o.slots?.idle();
	}

	/** Asks a serving worker for a tick now: a run ended, or an answer arrived. */
	wake(): void {
		this.#wakes.dispatchEvent(new Event("wake"));
	}

	#kindNamed(machineId: string): { readonly name: string; readonly kind: Kind } | undefined {
		const found = Object.entries(this.#o.config.kinds).find(([, kind]) => kind.machine.id === machineId);

		return found && { name: found[0], kind: found[1] };
	}

	/** Whether the item waits on the owner in its saved state: at an owner wait, or in a talk with them. */
	#isAsleep(saved: SavedSnapshot): boolean {
		const kind = this.#kindNamed(saved.kind)?.kind;

		return kind !== undefined && (isWaitingOnOwner(kind, saved.state) || isTalking(this.#o.config, kind, saved.state));
	}

	/** Whether the item's saved state is a talk with the owner. */
	#isTalking(saved: SavedSnapshot): boolean {
		const kind = this.#kindNamed(saved.kind)?.kind;

		return kind !== undefined && isTalking(this.#o.config, kind, saved.state);
	}

	/**
	 * A sleeping item in a talk wakes, as an answered item does, once its talk no longer waits on the owner: a row's
	 * answer counts, a row needs hum, or no row waits. The runner's talk watch brings that tick forward.
	 */
	async #wakeTalks(sleeping: readonly SavedSnapshot[]): Promise<void> {
		for (const { itemId } of sleeping.filter((saved) => this.#isTalking(saved) && !this.#inFlight.has(saved.itemId)))
			await this.#readThread(itemId, async () => {
				if (!(await talkWaits(this.#o.runner, itemId))) this.#answered.add(itemId);
			});
	}

	#dueWaits(t: number): SavedWait[] {
		return this.#o.state.items.saved().flatMap((saved) => {
			const kind = this.#kindNamed(saved.kind)?.kind;
			const wait = kind && { kind, saved };

			return wait && !this.#inFlight.has(saved.itemId) && isDue(this.#o.state, wait, t) ? [wait] : [];
		});
	}

	/**
	 * A saved wait whose deadline has passed fires now. One that ends stuck is saved and parked here; one that goes on to
	 * work is left as it was saved, and a pass restores it and fires its timeout with the real sources.
	 */
	async #fireDue(wait: SavedWait, t: number): Promise<void> {
		const { state } = this.#o;
		const { saved, kind } = wait;
		const due = dueClock(state, wait, t);
		const restored = await state.items.restore(saved.itemId, kind, { sources: neverSources(kind), clock: due.clock });

		if (!restored.ok || !restored.value) return;

		const actor = restored.value;

		actor.start();
		due.fireDue();

		await Bun.sleep(0);

		const value = String(actor.getSnapshot().value);

		if (hasEndedStuck(kind, value)) {
			state.items.save(saved.itemId, kind, persistedSnapshot(actor), passedOnto(saved.passed, saved.state, value));
			park({ state, now: this.#now }, { outcome: "stuck", item: saved.itemId, detail: `its wait in ${saved.state} timed out` });
		} else if (value !== saved.state) this.#timedOut.add(saved.itemId);

		actor.stop();
	}

	/** Shows on a card who already works on an item hum has not started, and takes the card down once no one does. */
	#showClaim(id: string, claimedBy: readonly string[]): void {
		const { faults } = this.#o.state;

		if (claimedBy.length === 0) faults.clear({ code: CLAIMED_CODE, item: id });
		else faults.raise({ code: CLAIMED_CODE, item: id, cause: `${id} is already taken by ${claimedBy.join(" and ")}, so hum starts no rival change.`, fix: "Unassign the item or close the pull request, and hum takes it at its next tick." });
	}

	/** Whether a split part waits on a part that has not merged; an item no split filed waits on none. */
	#isWaitingOnParts(id: string): boolean {
		const { state } = this.#o;

		return (state.parts.get(id)?.waitsOn ?? []).some((waited) => state.merges.get(waited) === undefined);
	}

	/** What came of an item so far: merged, or parked stuck or for review; nothing while it goes on. */
	#resultOf(item: string): Choice["result"] {
		const { state } = this.#o;

		return state.merges.get(item) ? "merged" : state.parked.get(item)?.why;
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
	 * Takes an item back from the parked. The owner's answer that takes it back, where one does, is their latest answer
	 * in the item's log, so its fix runs and rebuilds count afresh. A finished change keeps its saved landing and lands
	 * again, unless the owner asked to run it again; otherwise its saved state is dropped and its cap starts afresh.
	 */
	#unpark(id: string, answer: ThreadEntry | undefined): void {
		const { state } = this.#o;
		const parked = state.parked.get(id);

		if (!parked) return;

		state.parked.remove(id);
		state.faults.clear({ code: `item-${parked.why}`, item: id });

		if (answer) state.events.add(ownerAnswered(id, answer.at));

		const landsAgain = state.landings.get(id) !== undefined && answer?.option !== RUN_AGAIN;

		if (landsAgain) return;

		state.items.remove(id);
		state.landings.remove(id);
		dropReviews(state, id);

		const spent = state.spent.get(id);

		if (spent) state.spent.put(id, { ...spent, base: spent.total });
	}

	/**
	 * Where the owner answers only a question hum asked, or in CI, where a card is a log line with no action to answer
	 * it, each park asks one, so the owner can take the item back from its thread. An item that cannot be read raises
	 * its card and asks next tick.
	 */
	async #askParked(): Promise<void> {
		const { state, config, adapters, where } = this.#o;

		if (!adapters.answers?.onlyToQuestions && where !== "ci") return;

		const isAsked = ({ item, since }: Parked): boolean => state.questions.list().some((queued) => queued.item === item && queued.queuedAt >= since);

		for (const parked of state.parked.list().filter((held) => !isAsked(held))) {
			await this.#readThread(parked.item, async () => {
				const { question, plain } = parkQuestion(parked);

				queueQuestion({ state, config, now: this.#now }, await adapters.workSource.read(ItemId.parse(parked.item)), question, plain);
			});
		}
	}

	/** Where an item stands when its thread is read, for the disposition of an answer to it. */
	#stageOf(id: string, ready: boolean, sleeping: ReadonlyMap<string, SavedSnapshot>): AnswerScope {
		const parked = this.#o.state.parked.get(id);

		if (this.#inFlight.has(id)) return { stage: "running" };

		if (parked) return { stage: parked.why === "review" ? "approval" : "waiting", options: PARK_OPTIONS[parked.why], since: parked.since };

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

			const ready = await adapters.workSource.listReady();

			for (const { id, title } of ready) this.#titles.set(id, title);

			return { changed: watched.changed, ready };
		} catch {
			return undefined;
		}
	}

	/**
	 * Reads the threads that can have changed, settles each new answer, and releases a parked item the owner answered.
	 * Each item is read on its own: one that fails raises a card naming it and is read again next tick, and the rest go on.
	 * A work job reads only the items gather claimed, the only ones its source holds; gather read every thread.
	 */
	async #readAnswers(sleeping: readonly SavedSnapshot[], changed: boolean): Promise<void> {
		const { state, adapters, config, ciJob } = this.#o;
		const inbox = this.#inbox();

		if (!changed && inbox.length === 0 && this.#unread.size === 0) return;

		const waiting = new Set(sleeping.map((s) => s.itemId));
		const asleep = new Map(sleeping.map((s) => [s.itemId, s]));
		const parked = state.parked.list();
		const asked = recentlyAsked({ state, config, now: this.#now });
		const mayHaveChanged = [...new Set([...waiting, ...parked.map((p) => p.item), ...inbox, ...asked, ...this.#unread])];

		await Promise.all(
			(ciJob?.kind === "work" ? mayHaveChanged.filter((id) => ciJob.claimed.has(id)) : mayHaveChanged).map((id) =>
				this.#readThread(id, async () => {
					const raw = await adapters.workSource.read(ItemId.parse(id));
					const item = await settleAnswers({ state, workSource: adapters.workSource, judge: this.#judge, now: this.#now }, raw, this.#stageOf(id, raw.ready, asleep));
					const held = parked.find((p) => p.item === id);
					const lastAnswer = item.thread.findLast((e) => e.kind === "answer");
					const lastAnswerAt = lastAnswer?.at;

					if (held) {
						if (isAnsweredSince(lastAnswerAt, held.since)) this.#unpark(id, lastAnswer);

						return;
					}

					const wait = asleep.get(id);

					if (wait && answerTo(item, wait.savedAt)) this.#answered.add(id);
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
			if (error instanceof Error && (await this.#endIfGone(error))) return;

			this.#unread.add(id);
			faults.raise({ code: UNREAD_CODE, item: id, cause: `The thread of ${id} could not be read: ${error instanceof Error ? error.message : String(error)}`.slice(0, ERROR_EXCERPT), fix: "hum reads it again each tick and goes on with the other items." });
		}
	}

	/**
	 * Once, on the Mac: the items this worker's holder claimed before it started, which it goes on with at once, as a
	 * hum restarted on the same state folder. Another holder waits for those claims to expire. A failed read, whose
	 * guard raised the card, is made again next tick.
	 */
	async #takeBack(): Promise<void> {
		if (this.#tookBack || this.#o.where !== "mac") return;

		const claimed = await this.#o.adapters.workSource.listClaimed(this.#o.holder).catch(() => undefined);

		if (claimed === undefined) return;

		for (const { id } of claimed) this.#resuming.add(id);

		this.#tookBack = true;
	}

	/** Every claim in flight is renewed; a run whose claim is gone stops. */
	async #renew(): Promise<void> {
		const { adapters, holder, config } = this.#o;

		await Promise.all(
			[...this.#inFlight].map(async ([id, run]) => {
				const claim = await adapters.workSource.renew(ItemId.parse(id), holder, claimTtlMs(config)).catch(async (error: Error) => void (await this.#endIfGone(error)));

				if (claim?.won === false) run.abort.abort();
			}),
		);
	}

	/** A pass, or in a gather job its claim and settling alone, kept for the work job. */
	async #pass(o: ThinPathOptions & { readonly itemId: ItemId }): Promise<ThinResult> {
		const job = this.#o.ciJob;

		if (job?.kind !== "gather") return runThinPath(o);

		const gathered = await gatherItem(o, o.itemId);

		if (!isGathered(gathered)) return gathered;

		job.gathered.set(o.itemId, gathered.item);

		return { outcome: "waiting", item: o.itemId };
	}

	/** Starts `task` beside the tick, where `idle` waits for it, and says whether it started: once the worker stops its work, nothing new does. */
	#beside(task: () => Promise<void>): boolean {
		if (this.#halt.signal.aborted) return false;

		void this.#pool.add(task);

		return true;
	}

	/** Begins the item's pass beside the tick, stopped when its claim is lost or the worker stops its work; says whether it began. */
	#begin(id: string, known: Known, t: number): boolean {
		const { state, config, adapters } = this.#o;
		const abort = new AbortController();

		return this.#beside(() => {
			this.#inFlight.set(id, { abort, since: t, known });

			return this.#pass({
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
				talkCopy: this.#o.talkCopy,
				dir: this.#o.dir,
				itemId: ItemId.parse(id),
				signal: AbortSignal.any([abort.signal, this.#halt.signal]),
				gate: this.#gate,
				now: this.#now,
				runnerVariables: this.#o.runnerVariables,
				newSessionId: this.#o.newSessionId,
				pulls: this.#o.pulls,
				commits: this.#o.commits,
				signs: this.#o.ciJob?.kind === "work" ? this.#o.ciJob.signs : undefined,
				mayLand: () => this.#updating === undefined,
				publish: this.#o.ciJob?.kind === "work" ? this.#o.ciJob.publish : undefined,
			}).then(
				(result) => this.#ended(id, known, result),
				(error: Error) => this.#failed(id, error),
			);
		});
	}

	#ended(id: string, known: Known, result: ThinResult): void {
		this.#inFlight.delete(id);
		this.#o.state.faults.clear({ code: RUN_ERROR_CODE, item: id });

		if (this.#o.ciJob) this.#handled.add(id);

		if (result.outcome === "merged")
			this.#merged.unshift({
				item: id,
				title: known.title,
				mergedAt: this.#now(),
			});

		if (result.outcome === "merged" && this.#o.ciJob === undefined) this.#beside(() => this.#checkBase(id));

		if ((result.outcome === "held" && this.#o.state.landings.get(id) !== undefined) || doesStartOver(result)) this.#resuming.add(id);

		this.#o.onResult?.(result);
		this.wake();
	}

	/** After a merge, the repo's checks run on the base; a failure there files a follow-up and joins the fix limit. In a CI wake the work job runs them, the one job that holds no token. */
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

	/** Raises the engine card with this cause, in place of one that names another, or clears it. */
	#showEngineCard(card: { readonly cause: string; readonly fix: string } | undefined): void {
		const { faults } = this.#o.state;

		if (faults.list().some((shown) => shown.code === ENGINE_CODE && shown.cause !== card?.cause)) faults.clear({ code: ENGINE_CODE });

		if (card) faults.raise({ code: ENGINE_CODE, ...card });
	}

	get #engineHome(): EngineHome {
		const { repo, remote, base = DEFAULT_BASE, config } = this.#o;

		return { repo, remote, base, timeoutMs: commandTimeoutMs(config.hum) };
	}

	/**
	 * Keeps the repo on the newest published engine, on the Mac where hum.json allows it, once a latestVersionCacheSeconds:
	 * it pins a newer engine on the base beside the tick, and once the base pins an engine other than the one running,
	 * the worker drains and its checkout takes that engine. A failure is a card, kept per version until the base moves.
	 */
	async #lookAtEngine(t: number): Promise<void> {
		const { state, config, latestVersion, ciJob, pulls, commits } = this.#o;

		if (latestVersion === undefined || ciJob !== undefined || !config.hum.engineUpdates || this.#bumping || this.#adopting !== undefined) return;

		if (t - this.#engineAt < config.hum.latestVersionCacheSeconds * SECOND_MS) return;

		this.#engineAt = t;

		const home = this.#engineHome;

		const step = await engineStep(home, { running: this.#version, latest: await this.#latest(), tried: (version) => state.engineUpdates.get(version) }).catch((error: Error) => ({
			kind: "held" as const,
			cause: `Looking for a newer hum failed: ${error.message}`.slice(0, ERROR_EXCERPT),
			fix: "hum looks again after latestVersionCacheSeconds.",
		}));

		this.#showEngineCard(step.kind === "held" ? step : undefined);

		if (step.kind === "adopt") this.#adopting = step;

		if (step.kind !== "bump") return;

		const { version, base } = step;

		const failed = (cause: string, fix: string) => {
			state.engineUpdates.put(version, { version, outcome: "failed", cause, fix, base, at: this.#now() });
			this.#showEngineCard({ cause, fix });
		};

		this.#bumping = true;
		this.#beside(async () => {
			try {
				const bumped = await bumpEngine({ ...home, version, running: this.#version, hum: config.hum, pulls, commits });

				if (bumped.kind === "failed") return failed(bumped.cause, bumped.fix);

				if (bumped.kind === "opened") {
					state.engineUpdates.put(version, { version, outcome: "opened", pull: bumped.pull, at: this.#now() });

					return this.#showEngineCard({ cause: `The pin of hum ${version} waits in ${bumped.pull}.`, fix: `Merge it; hum installs ${version} once ${home.base} pins it.` });
				}

				this.#engineAt = Number.NEGATIVE_INFINITY;
			} catch (error) {
				failed(`Updating hum to ${version} failed: ${error instanceof Error ? error.message : String(error)}`.slice(0, ERROR_EXCERPT), `hum tries ${version} again once ${home.base} moves.`);
			} finally {
				this.#bumping = false;
				this.wake();
			}
		});
	}

	/** Installs the engine the base pins in the checkout, now that nothing runs; says whether it did. A failure leaves the engine it runs installed, and a card. */
	async #adopt(): Promise<boolean> {
		const adopting = this.#adopting;

		if (adopting === undefined) return true;

		this.#adopting = undefined;

		const { version, base } = adopting;
		const adopted = await adoptEngine(this.#engineHome, { version, running: this.#version });

		if (adopted.ok) return true;

		this.#o.state.engineUpdates.put(version, { version, outcome: "failed", cause: adopted.cause, fix: adopted.fix, base, at: this.#now() });
		this.#showEngineCard(adopted);

		return false;
	}

	/** The review-note loop runs once an interval, off the tick, so a slow model call never holds a tick. A pass that fails raises its card; one that succeeds clears it. */
	#loopIfDue(t: number): void {
		const { state, config } = this.#o;

		if (t - this.#loopAt < config.hum.loopIntervalSeconds * SECOND_MS) return;

		this.#loopAt = t;
		this.#beside(() =>
			this.#runLoop().then(
				() => state.faults.clear({ code: LOOP_CODE }),
				(error: Error) => {
					state.faults.raise({ code: LOOP_CODE, cause: `The review-note loop failed: ${error.message}`.slice(0, ERROR_EXCERPT), fix: "It runs again next interval; look at the cause if this card stays." });
				},
			),
		);
	}

	async #runLoop(): Promise<void> {
		const { state, config, adapters, repo, remote, base = DEFAULT_BASE, runner, pulls, loop } = this.#o;
		const git = gitIn(repo, { timeoutMs: commandTimeoutMs(config.hum) });
		const call = modelCallOver(runner, { model: config.hum.decisionModel, timeoutMs: config.hum.modelCallTimeoutSeconds * SECOND_MS, trusts: () => true, onSpent: (item, tokens) => tallyOf(state, item).spend(tokens) });

		await during("fetch the base", () => git.raw(["fetch", "-q", remote, `+refs/heads/${base}:${LOOP_REF}`]));

		const tip = (await git.raw(["rev-parse", LOOP_REF])).trim();

		if (pulls) await during("settle merged pull requests", () => settleMergedPulls(state, { pulls, workSource: adapters.workSource, git, remote }, this.#now()));

		const changes = await during("read the base's history", () => readHistory(git, tip, config.hum));

		await during("read and pair review notes", () => runLoopPass({
			state,
			config,
			workSource: adapters.workSource,
			now: this.#now,
			comments: loop?.comments ?? (async () => []),
			ciLogs: loop?.ciLogs ?? (async () => []),
			history: async () => changes,
			hunkOf: async (sha, file) => (await git.run(["show", ...PATCH, "-U3", "--format=", sha, ...(file === undefined ? [] : ["--", file])])).stdout,
			propose: modelProposer(call),
			trusts: (models) => doesTrustRepeats(models, config.hum),
			memoryPath: join(repo, ".hum", "memory.md"),
		}));

		await during("keep merged cases", () => keepMergedCases(state, changes, config.hum, {
			itemText: (item) => adapters.workSource.read(ItemId.parse(item)).then(({ title, body }) => ({ title, body }), () => undefined),
			diff: (from, to) => git.raw(["diff", ...PATCH, from, to]),
		}));
	}

	/** Raises the judge card with this cause, in place of one that names another. */
	#showJudgeCard(cause: string, fix: string): void {
		const { faults } = this.#o.state;

		if (faults.list().some((card) => card.code === JUDGE_CODE && card.cause !== cause)) faults.clear({ code: JUDGE_CODE });

		faults.raise({ code: JUDGE_CODE, cause, fix });
	}

	/**
	 * A score whose judge changed since it was measured keeps gating. Where hum can keep a measurement, it measures
	 * those judges again, once a loop interval and outside a usage limit; the new scores in `.hum/hum.json` restart the
	 * worker, which gates on them, so a judge whose new rate misses the bar abstains from then on. Where it cannot, or
	 * the measurement fails, a card names the old scores.
	 */
	#judgesIfDue(t: number): void {
		const { state, config, runner, remeasure } = this.#o;
		const stale = this.#stale;

		if (stale.length === 0) return state.faults.clear({ code: JUDGE_CODE });

		const gating = `${staleText(stale)} gate on rates measured before the judge's prompt or role text last changed.`;

		if (remeasure === undefined) return this.#showJudgeCard(gating, "Run `bunx hum setup measure` where Claude Code is signed in and commit .hum/hum.json; CI cannot keep a rate it measures.");

		if (this.#measuring || t - this.#remeasureAt < config.hum.loopIntervalSeconds * SECOND_MS || runner.limitedUntil() > t) return;

		const { signal } = this.#halt;
		const failed = (why: string) => this.#showJudgeCard(`${gating} Measuring them again failed: ${why}`, "hum tries again after loopIntervalSeconds; `bunx hum setup measure` measures them now.");

		this.#remeasureAt = t;
		this.#beside(async () => {
			this.#measuring = true;

			try {
				for (const measurement of byModel(stale)) {
					if (signal.aborted) return;

					const measured = await remeasure({ ...measurement, runs: config.hum.evalRuns }, signal);

					if (!measured.ok && !signal.aborted) failed(`${measurement.model}: ${measured.why}`);
				}
			} catch (error) {
				failed(error instanceof Error ? error.message : String(error));
			} finally {
				this.#measuring = false;
			}
		});
	}

	async #failed(id: string, error: Error): Promise<void> {
		this.#inFlight.delete(id);

		if (this.#o.ciJob) this.#handled.add(id);

		if (!(await this.#endIfGone(error)))
			this.#o.state.faults.raise({
				code: RUN_ERROR_CODE,
				item: id,
				cause: `The run for ${id} failed: ${error.message}`.slice(0, ERROR_EXCERPT),
				fix: "hum tries the item again when its claim lapses; look at the cause if this card stays.",
			});

		this.wake();
	}

	/**
	 * Ends the item `error` names where its source no longer holds it, and says whether it did: its pass and runs stop,
	 * and nothing hum kept for it starts work or shows a card again. Every other item stays as it was.
	 */
	async #endIfGone(error: Error): Promise<boolean> {
		if (!(error instanceof ItemGone)) return false;

		const { state, runner } = this.#o;
		const { item } = error;

		this.#inFlight.get(item)?.abort.abort();
		this.#inFlight.delete(item);

		for (const held of [this.#resuming, this.#answered, this.#timedOut, this.#unread]) held.delete(item);

		forgetItem(state, item);

		for (const card of state.faults.list()) if (card.item === item) state.faults.clear(card);

		await runner.forget?.(state.runs.list(item).map(({ name }) => name)).catch((cause: Error) => {
			state.faults.raise({ code: END_CODE, item, cause: `${item} left its source, and hum could not stop its runs: ${cause.message}`.slice(0, ERROR_EXCERPT), fix: "Stop the item's rows yourself; hum starts nothing more for it." });
		});

		return true;
	}

	/** Stops the worker's work: nothing new starts, every pass and measurement in flight stops, and it resolves once they and the tick in flight have ended. */
	async #stopWork(): Promise<void> {
		this.#halt.abort();

		await this.idle();
	}

	/** The heartbeat and the status file, both by temp file and rename, each with the version of the engine this process runs. */
	async #publish(t: number, restarting: string | undefined): Promise<void> {
		const { state, config, where = "mac" } = this.#o;

		writeHeartbeat(state.heartbeatPath, {
			time: t,
			engineVersion: this.#version,
			configHash: config.hash,
			inFlight: this.running(),
			intervalMs: config.hum.tickIntervalSeconds * SECOND_MS,
			restarting,
		});

		const read = readStatus(state.statusPath);
		const before = read.ok ? read.status : emptyStatus(this.#version, t);
		const memory = readMemory(join(this.#o.repo, ".hum", "memory.md"), config.hum.memoryMaxBytes);

		this.#showRefusedMemory(memory.refused);
		const open = this.#openItems();
		const questions = openQuestions(state.questions.list(), state.answers.list());
		await this.#keepFeeds(open.map(({ item }) => item));

		const [latest, ci, links] = await Promise.all([this.#latest(), this.#ciTick(), this.#links([...new Set([...open.map(({ item }) => item), ...questions.map(({ item }) => item)])])]);
		writeStatus(state.statusPath, {
			...before,
			writtenAt: t,
			workers: { ...before.workers, ci: ci ?? before.workers.ci, [where]: t },
			engine: {
				version: this.#version,
				adapterApi: ADAPTER_API_VERSION,
				configSchema: SCHEMA_VERSION,
				latest,
			},
			questions: questions.map((question) => ({ ...question, row: links.get(question.item)?.ask })),
			choices: newestChoices(state.choices.list(), config.hum.choicesShown).map((choice) => ({ ...choice, result: this.#resultOf(choice.item) })),
			cards: state.faults.list(),
			open: open.map((item) => ({ ...item, rows: links.get(item.item)?.rows, handoff: links.get(item.item)?.handoff })),
			merged: [...this.#merged.splice(0), ...before.merged].slice(0, this.#o.config.hum.mergedShown),
			possibleRepeats: state.possibleRepeats.list().map(({ a, b }) => ({ a, b })),
			unusedMemory: this.#unusedMemory(memory.entries),
			measure: measureOf({ ...measureInputsOf(state), window: config.hum.measureWindow, globs: config.hum.paths.map(({ glob }) => glob) }) ?? null,
			rules: state.learned.list().map(({ glob, level, item, at, commit }) => ({ glob, level, item, at, undo: { label: "Undo", command: `git revert ${commit}` } })),
		});
	}

	/** Each open item's feed row, where the runner keeps such rows, so an item hum held before them gets one too; a failure raises one card until a tick starts every one. */
	async #keepFeeds(items: readonly string[]): Promise<void> {
		const { runner, state } = this.#o;

		if (runner.keepFeeds === undefined) return;

		await runner.keepFeeds(items).then(
			() => state.faults.clear({ code: FEEDS_CODE }),
			(error: Error) => void state.faults.raise({ code: FEEDS_CODE, cause: `hum could not start the row that shows you each item: ${error.message}`.slice(0, ERROR_EXCERPT), fix: "hum tries again at its next tick." }),
		);
	}

	/** Where the owner opens each of `items`, where the runner has such places; a read that fails raises one card, and the status shows no links until a read goes through. */
	async #links(items: readonly string[]): Promise<ReadonlyMap<string, ItemLinks>> {
		const { runner, state } = this.#o;

		if (runner.links === undefined) return new Map();

		return runner.links(items).then(
			(links) => {
				state.faults.clear({ code: LINKS_CODE });

				return links;
			},
			(error: Error) => {
				state.faults.raise({ code: LINKS_CODE, cause: `hum could not read where you open each item's rows: ${error.message}`.slice(0, ERROR_EXCERPT), fix: "hum reads them again at its next tick." });

				return new Map();
			},
		);
	}

	/** Where the saved item's flow stands, as the kind it was saved under runs it; undefined where the state folder keeps no such kind. */
	#flowAt(saved: SavedSnapshot, at: string): FlowAt | undefined {
		const key = `${saved.kind}@${saved.machineVersion}`;

		if (!this.#flows.has(key)) {
			const kind = this.#o.state.kinds.get(key);

			if (kind) this.#flows.set(key, flowOf(kind));
		}

		return this.#flows.get(key)?.(at, saved.passed);
	}

	/** Every item with a saved state that has not ended: where its flow stands, and whether a pass runs on it now. */
	#openItems(): OpenItem[] {
		const { state } = this.#o;

		return state.items.saved().flatMap((saved) => {
			const flow = saved.state === undefined ? undefined : this.#flowAt(saved, saved.state);

			if (flow === undefined) return [];

			const run = this.#inFlight.get(saved.itemId);
			const title = run?.known.title ?? this.#titles.get(saved.itemId);

			return [{ item: saved.itemId, title, kind: state.itemKinds.get(saved.itemId)?.kind ?? saved.kind, flowVersion: saved.machineVersion, ...flow, since: run?.since ?? saved.savedAt, running: run !== undefined }];
		});
	}

	/**
	 * Why the worker must restart: the installed engine differs from the one it runs, so a worker that loaded the old code
	 * just before an update moved the link still sees it, or the lockfile, `.hum/` or `adapters/` differ from those at start.
	 */
	#updateSeen(now: Signature): string | undefined {
		if (now.engineVersion !== this.#version) return `the engine changed from ${this.#version} to ${now.engineVersion}`;

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

		this.#titles.set(id, item.title);

		return { footprint: footprintOf(item) ?? undeclaredFootprint(this.#o.config.hum), title: item.title, claimedBy: item.claimedBy ?? [] };
	}

	/** Which waiting items start now, by the scheduler's rules, and starts them. */
	async #startPicked(t: number, ready: readonly ItemRef[], sleeping: readonly SavedSnapshot[]): Promise<string[]> {
		const { state, runner, config } = this.#o;
		const parked = new Set(state.parked.list().map((p) => p.item));
		const asleep = new Set(sleeping.map((s) => s.itemId));
		const isFresh = (id: string) => !this.#inFlight.has(id) && !parked.has(id) && !asleep.has(id) && !this.#handled.has(id);
		const isWokenAndIdle = (id: string) => (this.#answered.has(id) || this.#timedOut.has(id)) && !this.#inFlight.has(id);
		const learned = (id: string) => this.#learn(id).catch(async (error: Error) => void (await this.#endIfGone(error)));

		const fresh = ready.flatMap((ref) => (isFresh(ref.id) && !this.#isWaitingOnParts(ref.id) ? [learned(ref.id).then((known) => ({ id: ref.id, answered: false, known }))] : []));

		const answered = sleeping.flatMap((s) => {
			const named = this.#kindNamed(s.kind);

			return isWokenAndIdle(s.itemId) ? [learned(s.itemId).then((known) => ({ id: s.itemId, answered: true, known: known && named && { ...known, kind: named.name } }))] : [];
		});

		const resumed = [...this.#resuming].flatMap((id) => (isFresh(id) && !ready.some((ref) => ref.id === id) ? [learned(id).then((known) => ({ id, answered: true, known }))] : []));

		/** Who else works on an item hum has not started; no one rivals an item the owner answered or hum goes on with. */
		const rivalsOf = (id: string, answered: boolean, known: Known): readonly string[] => (answered || hasProgress(state, id) ? [] : known.claimedBy);
		const candidates = (await Promise.all([...fresh, ...answered, ...resumed])).flatMap(({ id, answered, known }) => (known ? [{ id, answered, known, rivals: rivalsOf(id, answered, known) }] : []));

		for (const { id, rivals } of candidates) this.#showClaim(id, rivals);

		const waiting = candidates.filter(({ rivals }) => rivals.length === 0);
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

			if (!known || !this.#begin(id, known, t)) return [];

			this.#answered.delete(id);
			this.#timedOut.delete(id);
			this.#resuming.delete(id);

			return [id];
		});
	}

	/** One tick, which `idle` waits for as it does for the work the tick starts. */
	tick(): Promise<TickResult> {
		return this.#pool.add(() => this.#tick());
	}

	async #tick(): Promise<TickResult> {
		const { state, config } = this.#o;
		const t = this.#now();

		await Promise.all(this.#dueWaits(t).map((due) => this.#fireDue(due, t)));

		if (config.hum.ciToken) checkTokenAge(state.faults, { setUp: config.hum.ciToken.setUp, now: t, warnDays: config.hum.tokenWarnDays });

		const signature = signatureOf({ repo: this.#o.repo, fallbackVersion: this.#version, itemsDir: this.#o.config.hum.itemsDir });
		const seen = this.#updateSeen(signature);

		if (seen === undefined) await this.#lookAtEngine(t);

		const update = seen ?? (this.#adopting === undefined ? undefined : `the base pins hum ${this.#adopting.version}`);

		this.#updating = update;
		const sleeping = state.items.saved().filter((s) => this.#isAsleep(s));

		await this.#renew();

		this.#o.slots?.keepReady();

		if (update !== undefined) {
			await this.#publish(t, update);

			if (this.#inFlight.size > 0 || this.#measuring || this.#bumping) return { kind: "draining", reason: update };

			return (await this.#adopt()) ? { kind: "exit", reason: update } : { kind: "ran", started: [] };
		}

		const sources = await this.#readSources();

		await this.#takeBack();

		if (this.#o.ciJob?.kind !== "work") {
			await this.#askParked();
			await releaseQuestions({ state, config, workSource: this.#o.adapters.workSource, questions: this.#o.adapters.questions, now: this.#now }).then(
				() => state.faults.clear({ code: RELEASE_CODE }),
				async (error: Error) => {
					if (await this.#endIfGone(error)) return;

					state.faults.raise({ code: RELEASE_CODE, cause: `Queued questions could not be asked: ${error.message}`.slice(0, ERROR_EXCERPT), fix: "hum asks them again on the next tick." });
				},
			);

			this.#loopIfDue(t);
			this.#judgesIfDue(t);
		}

		await this.#wakeTalks(sleeping);

		const ready = await this.#readReady(sources, sleeping);
		const started = ready ? await this.#startPicked(t, ready, sleeping) : [];

		await this.#publish(t, undefined);

		return { kind: "ran", started };
	}

	/** Ticks until an update is seen and the runs have ended, or `stop` fires. An end of a run, an inbox file or `wake` brings the next tick forward. */
	async serve(stop?: AbortSignal): Promise<Exit> {
		const { state, config } = this.#o;

		mkdirSync(state.inbox, { recursive: true });

		const life = runLifecycle(
			{
				tick: () => this.tick(),
				stopWork: () => this.#stopWork(),
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
