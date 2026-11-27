import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import PQueue from "p-queue";
import { z } from "zod";
import { type AnyActor, type AnyActorLogic, createActor, createAsyncLogic } from "xstate";
import type { Holder, Item, ItemId, Question, Questions, ThreadEntry, WorkSource } from "../adapter-api.ts";
import { type Finished, type Paused, type RunOutcome, type Runner, hasSucceeded, isPaused } from "../adapters/claude-p.ts";
import { configuredModelCall, type ModelCall } from "../adapters/model-call.ts";
import { visibleText } from "../adapters/marked.ts";
import { filesBetween, type Git, gitIn, isAncestor, PATCH, withConfigPinned } from "../adapters/git.ts";
import type { PullRequests } from "../adapters/pull-requests.ts";
import { pickTier } from "../config/checks.ts";
import type { Config } from "../config/load.ts";
import { earliestTimeout, interactionAt, invokedSources, isApprovalWait, isWaitingOnOwner, kindMachine, OWNER_APPROVED, OWNER_REJECTED, TOKEN_CAP } from "../config/machine.ts";
import { type Kind, type Naming, PURPOSES, STUCK_TAG, TALK_PURPOSES } from "../config/schema.ts";
import { commandTimeoutMs } from "../exec.ts";
import { doesLeaveDocs } from "../decide/kind.ts";
import { type EventPick, type JsonSchema, jsonSchemaOf, type ProsePurpose, planHash, REQUEST_CHANGES, requestedChanges, SPLIT, type SplitPart } from "../decide/prose.ts";
import { answerOnce, foldItem, type ItemFold, keepPick, machineStarted, ownerAnswered, rebuilt } from "../state/item-log.ts";
import type { State } from "../state/open.ts";
import type { Parked, SavedRepro, SavedTalk } from "../state/saved.ts";
import { type SavedSnapshot, passedOnto, persistedSnapshot } from "../state/items.ts";
import { dueClock, isDue } from "./due.ts";
import { HOUR_MS, SECOND_MS } from "../time.ts";
import { checkLimits, firstFailing, runChecks } from "./checks.ts";
import { BASE_CONTENDED, carriedVerdict, changeOn, declaredChange, type LandContext, patchOf, placementOf, rebaseOnto, type ReviewOutcome, tierOf } from "./land.ts";
import { OWNER_APPROVAL, REVIEW_APPROVAL } from "../decide/merge.ts";
import { askDecision, askedQuestion, isOverCapStop, isWaitQuestion, OVER_CAP_OPTIONS, PLAIN_QUESTIONS, type PlainQuestion, RunReason } from "../decide/question.ts";
import { humOptions, PARK_OPTIONS, RUN_AGAIN, type Stage } from "../decide/answer.ts";
import { type ItemText, type ReadFile, reviewInput } from "../decide/review.ts";
import { answerText, IdeateAnswer, PickAnswer, type BuildChoice, choicesAnswer, talkedBody } from "../decide/talk.ts";
import { NO_REVIEW_FILES, readReviewFiles } from "./review-files.ts";
import { forgetProgress, keepKind, kindAnswered, pickKind } from "./kind.ts";
import { type OwnerAnswer, planChangingAnswers, settleAnswers } from "./answers.ts";
import { queueQuestion } from "./questions.ts";
import { answerToLatest, latestQuestionAt, openQuestion } from "./thread.ts";
import { memorySection, readMemory, rulesUsed } from "../loop/memory.ts";
import { proveCheckItem } from "../loop/prove-item.ts";
import { tallyOf } from "./tally.ts";
import { keepReview } from "./owner-handoff.ts";
import { runName } from "../state/runs.ts";
import { decideProse } from "./prose-run.ts";
import { type PrefixGate } from "./scheduler.ts";
import { evidenceRef, keepEvidence } from "./evidence.ts";
import { Outbox } from "../publish/intents.ts";
import { type GatherTrust, type PassOutbox, type Publisher, publishPass, settleSavedLanding } from "../publish/publisher.ts";
import { PUBLISH_DIR as PUBLISH_REPO } from "../state/open.ts";
import type { GitHubCommits } from "../adapters/github-commits.ts";
import { repoFromRemote } from "../adapters/github.ts";
import { signsCommits, type Uncarried, uncarriedChange } from "./signed-push.ts";

/** How long a claim lasts unless its holder renews it. */
export const claimTtlMs = (config: Config): number => config.hum.claimExpirySeconds * SECOND_MS;

const CARD_EXCERPT = 300;

const ERROR_EXCERPT = 500;

const SHORT_SHA = 12;

/** The branch runs start from when none is given. */
export const DEFAULT_BASE = "main";

export const runBranch = ({ runBranchPrefix }: Naming, id: string): string => `${runBranchPrefix}${id}`;

/** The pull request a build or fix run writes for the branch's whole change, and the one file of evidence it saved, by name. */
const PullRequestWritten = z.object({ title: z.string().min(1), body: z.string().min(1), evidence: z.string().min(1).optional() });

type PullRequestWritten = z.infer<typeof PullRequestWritten>;

/** The check a repro run wrote: the command that fails because of the bug, and what stood in where the reported environment was not at hand. */
const ReproWritten = z.object({ command: z.string().min(1), translated: z.string().min(1).optional() });

/** What the agent run hands back besides the change it leaves in the working tree. */
export const RUN_SCHEMA = jsonSchemaOf(z.object({ status: z.enum(["done", "needs-owner"]), question: z.string().optional(), plan: z.string().optional(), reason: RunReason.optional(), memoryUsed: z.array(z.int().positive()).optional(), pullRequest: PullRequestWritten.optional(), repro: ReproWritten.optional() }));

/** The comment that carries a run's plan on the item's thread, so the next run reads it. */
export const PLAN_MARK = "hum plan:";

export type ThinPathOptions = {
	readonly workSource: WorkSource;
	readonly questions: Questions;
	readonly state: State;
	readonly runner: Runner;
	readonly config: Config;
	/** The cheap model call; by default the config's decision model through the runner. */
	readonly judge?: ModelCall;
	/** The work repo's remote: a URL or path. Runs clone it; nothing touches the owner's checkout. */
	readonly remote: string;
	readonly base?: string;
	/** The repo's checks as shell commands, run in the clone. All must exit 0. */
	readonly checks: readonly string[];
	readonly holder: Holder;
	/** Where runs clone to; a temp folder by default. */
	readonly workDir?: string;
	/** Gives the run its working copy on the remote's base branch, and takes it back when the item's pass ends. By default a `git clone` in a temp folder. */
	readonly checkout?: Checkout;
	/** Gives each run the owner talks to a talk copy of its own; where runs are Rail rows, the run slots give it. */
	readonly talkCopy?: TalkCopy;
	readonly dir?: string;
	/** Take this item; default the first ready one. */
	readonly itemId?: ItemId;
	readonly now: () => number;
	/** Aborted when the worker loses the claim or exits for an update; the run stops and the result is `lost`. */
	readonly signal?: AbortSignal;
	/** Lets the first run of a shared prompt prefix reach its first token before the rest start. */
	readonly gate?: PrefixGate;
	/** The remote's pull requests and branch rules, for a remote on GitHub. */
	readonly pulls?: PullRequests;
	/** The remote's branches through GitHub's API, which signs the commits it makes, for a remote on GitHub. */
	readonly commits?: GitHubCommits;
	/** Whether the base's rules require signed commits; by default read through `pulls`. A wake's work job holds no token, so gather reads it. */
	readonly signs?: boolean;
	/** The names, never the values, of the variables the runs have; a missing secret is checked against them. */
	readonly runnerVariables: ReadonlySet<string>;
	/** A fresh id for each run's session. */
	readonly newSessionId: () => string;
	/** Applies a pass's outbox, given what the pass's own work came to; by default publish runs in this process once the pass's runs ended. */
	readonly publish?: (pass: PassOutbox, worked: ThinResult) => Promise<ThinResult | undefined>;
	/** False while the worker drains for an update: a finished change is saved and pushed, and the next worker lands it under the config it starts with. */
	readonly mayLand?: () => boolean;
};

export type ThinResult =
	| { readonly outcome: "idle" }
	| { readonly outcome: "lost" | "waiting"; readonly item: string }
	/** The item's change showed it is another kind: it runs again from the start as that kind, on the same branch restarted at the base. */
	| { readonly outcome: "moved"; readonly item: string; readonly kind: string }
	/** The item's change no longer held on the newest base: it runs again from the start, on its branch restarted at the base. */
	| { readonly outcome: "restarted"; readonly item: string; readonly why: string }
	| { readonly outcome: "merged" | "asked" | "stuck" | "review" | "landing"; readonly item: string; readonly detail?: string }
	| { readonly outcome: "limited"; readonly item: string; readonly until: number }
	| { readonly outcome: "held"; readonly item: string; readonly why: string };

type Answered = OwnerAnswer & { readonly option: string | undefined; readonly plan: string };

/** The question, the answer to it and the plan, once the owner has answered the latest question from `since` on. */
export const answerTo = (item: Item, since = 0): Answered | undefined => {
	const answer = answerToLatest(item.thread);

	if (!answer || answer.at < since) return undefined;

	const plan = item.thread.findLast((e) => e.kind === "comment" && e.text.startsWith(PLAN_MARK));

	return {
		question: item.thread[latestQuestionAt(item.thread)]?.text ?? "",
		answer: answer.option ? `${answer.option}: ${answer.text}` : answer.text,
		option: answer.option,
		plan: plan?.text.slice(PLAN_MARK.length).trim() ?? "",
		at: answer.at,
	};
};

/** The question the item's latest hum question puts, when it is one the item waits on and no applied answer follows it. */
const unansweredQuestion = (item: Item): ThreadEntry | undefined => {
	const question = openQuestion(item.thread);

	return question && isWaitQuestion(visibleText(question.text)) ? question : undefined;
};

/** Where an item saved in an owner wait stands for an answer: waiting on approval where the state takes the owner's approval, else waiting. */
export const ownerWaitStage = (kind: Kind, state: string | undefined): Stage => (isApprovalWait(kind, state) ? "approval" : "waiting");

const Wants = z.looseObject({ status: z.string().optional(), question: z.string().optional(), plan: z.string().optional(), reason: RunReason.optional(), pullRequest: PullRequestWritten.optional(), repro: ReproWritten.optional() });

type Wanted = z.infer<typeof Wants>;

/** The kind as it stood at an earlier machine version, kept by `rememberKinds`, so a saved item restores across a change. */
const earlierKinds = (state: State, kind: Kind) => (machineVersion: string) => state.kinds.get(`${kind.machine.id}@${machineVersion}`);

/** Saves every kind under its machine version. Call it whenever a config is loaded. */
export const rememberKinds = (state: State, config: Config): void => {
	for (const kind of Object.values(config.kinds)) state.kinds.put(`${kind.machine.id}@${kind.machine.version}`, kind);
};

/** Whether the kind's machine tags this state with `tag`. */
const hasTag = (kind: Kind, state: string | undefined, tag: string): boolean => (state !== undefined && kind.machine.states[state]?.tags?.includes(tag)) ?? false;

export const hasEndedStuck = (kind: Kind, state: string | undefined): boolean => hasTag(kind, state, STUCK_TAG);

/** Whether the kind's machine in this state runs a role the owner talks to. */
export const isTalking = (config: RunConfig, kind: Kind, state: string | undefined): boolean => {
	const source = state === undefined ? undefined : kind.machine.states[state]?.invoke?.src;
	const purpose = source === undefined ? undefined : (config.hum.roles[source]?.purpose ?? source);

	return TALK_PURPOSES.some((talk) => talk === purpose);
};

/** Whether every row of the item's talk waits on the owner, so a pass would find nothing to take from them or do about them. */
export const talkWaits = async (runner: Runner, id: string): Promise<boolean> => (await runner.talking?.())?.get(id) === true;

/** Placeholder sources: enough to restore a snapshot and read its state before the real sources exist. */
const stubSources = (kind: Kind) => invokedSources(kind, createAsyncLogic({ run: async () => {} }));

/**
 * The thin path: a ready markdown item is claimed, built by a `claude -p` run on its run branch,
 * checked by the repo's own checks, and merged in one push that also sets the item's state to done, when its
 * paths are all at the lowest level. A run that needs the owner pushes its branch, asks on the item and
 * ends; the answer starts a fresh run on that branch. Never `--resume`.
 */
const kindNamed = (config: Config, name: string): Kind => {
	const kind = config.kinds[name];

	if (!kind) throw new Error(`no kind "${name}" in the config`);

	return kind;
};

/** The outcomes that decide nothing about the item: it stays where its pass found it. */
type Undecided = Extract<ThinResult, { outcome: "idle" | "lost" | "waiting" | "limited" | "held" }>;

const UNDECIDED_OUTCOMES: readonly string[] = ["idle", "lost", "waiting", "limited", "held"] satisfies readonly Undecided["outcome"][];

const isUndecided = (result: ThinResult): result is Undecided => UNDECIDED_OUTCOMES.includes(result.outcome);

/** One pass of an item. A pass that decides the item, by any path, ends its hold on the base. */
export const runThinPath = async (o: ThinPathOptions): Promise<ThinResult> => {
	const result = await pass(o);

	if (!isUndecided(result)) o.state.faults.clear({ code: BASE_CONTENDED, item: result.item });

	return result;
};

/**
 * What a pass settles before any clone or run, all from the work source and saved state: the claim, the owner's
 * answers and the item's kind. Gather runs it apart from the work in CI; a pass that runs it again on what gather
 * settled writes nothing.
 */
export type Gathered = {
	readonly item: Item;
	readonly kindName: string;
	readonly kind: Kind;
	readonly judge: ModelCall;
	/** The item has a saved machine state to go on from. */
	readonly onSnapshot: boolean;
	readonly asking: boolean;
	readonly answered: ReturnType<typeof answerTo>;
	/** The owner's answers on the thread that changed the plan. */
	readonly ownerAnswers: readonly OwnerAnswer[];
	/** The saved owner wait whose timeout passed with no answer. */
	readonly timedOut: SavedSnapshot | undefined;
};

export const gatherItem = async (o: ThinPathOptions, id: ItemId): Promise<Gathered | ThinResult> => {
	// A parked item stays parked until the owner acts: its file still says ready, and a rerun would spend the same tokens again.
	const parked = o.state.parked.get(id);

	if (parked) return { outcome: parked.why, item: id, detail: parked.cause };

	// An item gets its kind before its first snapshot, so an item with no saved kind has nothing to restore.
	const known = o.state.itemKinds.get(id);
	const knownKind = known && kindNamed(o.config, known.kind);
	const saved = knownKind ? await o.state.items.restore(id, knownKind, { sources: stubSources(knownKind), kindAt: earlierKinds(o.state, knownKind) }) : ({ ok: true, value: undefined } as const);

	if (!saved.ok) return { outcome: "held", item: id, why: saved.fault.cause };

	const log = o.state.events.read(id);

	if (!log.ok) return { outcome: "held", item: id, why: log.fault.cause };

	const judge = o.judge ?? configuredModelCall(o.runner, o.config.hum, (item, tokens) => tallyOf(o.state, item).spend(tokens));

	if (await settleSavedLanding(publisherOf(o, judge), id)) return { outcome: "merged", item: id };

	const at = saved.value === undefined ? undefined : String(saved.value.getSnapshot().value);

	if (knownKind && hasEndedStuck(knownKind, at)) return park(o, { outcome: "stuck", item: id, detail: "the saved state ended stuck" });

	const claim = await o.workSource.claim(id, o.holder, claimTtlMs(o.config));

	if (!claim.won) return { outcome: "lost", item: id };

	const { now } = o;
	const onSnapshot = saved.value !== undefined;
	const ownerWait = knownKind && isWaitingOnOwner(knownKind, at) ? ownerWaitStage(knownKind, at) : undefined;
	const stage: Stage = o.state.landings.get(id) ? "approval" : (ownerWait ?? (onSnapshot ? "running" : "waiting"));
	const read = await o.workSource.read(id);
	const item = await settleAnswers({ state: o.state, workSource: o.workSource, judge, now }, read, { stage });
	const named = known && kindAnswered(known, item, o.config.hum.kinds);

	if (named) o.state.itemKinds.put(id, named);

	if (named && named.kind !== known?.kind) {
		forgetProgress(o.state, id);

		return { outcome: "moved", item: id, kind: named.kind };
	}

	// With no saved wait, the thread alone says whether the owner has been asked and has not answered; its age is the deadline.
	const unanswered = onSnapshot ? undefined : unansweredQuestion(item);

	if (unanswered) return unanswered.at + o.config.hum.questionTimeoutHours * HOUR_MS < now() ? park(o, { outcome: "stuck", item: id, detail: `no answer came within ${o.config.hum.questionTimeoutHours} hours` }) : { outcome: "waiting", item: id };

	const settled = named ?? known;
	const kindContext = { ...o, judge, now };
	const kindName = settled ? settled.kind : keepKind(kindContext, item, await pickKind(kindContext, item));
	const kind = kindNamed(o.config, kindName);
	const asking = isWaitingOnOwner(kind, at);
	const wait = asking ? o.state.items.savedOf(id) : undefined;
	const answered = asking ? answerTo(item, wait?.savedAt) : onSnapshot ? undefined : answerTo(item);
	const isAwaitingAnswer = asking && answered === undefined;
	const timedOut = isAwaitingAnswer && wait !== undefined && isDue(o.state, { kind, saved: wait }, now()) ? wait : undefined;

	if (isAwaitingAnswer && timedOut === undefined) return { outcome: "waiting", item: id };

	if (isTalking(o.config, kind, at) && (await talkWaits(o.runner, id))) return { outcome: "waiting", item: id };

	const stopped = answered !== undefined && isOverCapStop(visibleText(answered.question), answered.option);

	if (stopped && asking) return park(o, { outcome: "stuck", item: id, detail: "the owner stopped it at the token cap" });

	/* The owner's rejection at the approval wait ends the landing saved for it, so only a new change lands. */
	if (isApprovalWait(kind, at) && answered !== undefined && answered.option !== OWNER_APPROVAL) o.state.landings.remove(id);

	return { item, kindName, kind, judge, onSnapshot, asking, answered: stopped ? undefined : answered, ownerAnswers: planChangingAnswers(o.state, read, humOptions(o.config.hum)), timedOut };
};

export const isGathered = (gathered: Gathered | ThinResult): gathered is Gathered => "kindName" in gathered;

const pass = async (o: ThinPathOptions): Promise<ThinResult> => {
	const base = o.base ?? DEFAULT_BASE;
	const id = o.itemId ?? (await o.workSource.listReady())[0]?.id;

	if (id === undefined) return { outcome: "idle" };

	const gathered = await gatherItem(o, id);

	if (!isGathered(gathered)) return gathered;

	const { item, kindName, kind, judge, onSnapshot, asking, answered, ownerAnswers, timedOut } = gathered;
	const landing = o.state.landings.get(id);
	/** Nothing saved is left to go on from: a new item, one that moved to another kind, or one the owner ran again. */
	const isFresh = !onSnapshot && landing === undefined;
	const branch = runBranch(o.config.hum, id);
	const timeoutMs = commandTimeoutMs(o.config.hum);
	const taken = await (o.checkout ?? clonesIn(o.workDir, timeoutMs))({ remote: o.remote, base, item: id, signal: o.signal }).catch((error: Error) => (o.signal?.aborted ? undefined : Promise.reject(error)));

	if (taken === undefined) return { outcome: "lost", item: id };

	const { folder: clone, env, readyFailure } = taken;

	try {
		const checkedOut = gitIn(clone, { identity: o.config.hum.commitIdentity, timeoutMs });
		const gathered = await gatheredIn(checkedOut, { base, branch });

		await onRunBranch(checkedOut, { branch, restartAt: isFresh ? gathered.baseSha : undefined });

		/** From here a run may have written in the folder, so hum's git runs only while the config it read stands. */
		const git = await withConfigPinned(checkedOut);
		const g = (args: readonly string[]): Promise<string> => git.raw(args);

		/** Where a run saves its one picture or video of the change, outside the clone so nothing commits it. */
		const evidence = mkdtempSync(join(o.workDir ?? tmpdir(), "hum-evidence-"));

		try {
			const outbox = new Outbox(id);
			const ownChecks = ownChecksOf(o.state, id);
			const driven: Driven = { ...o, checks: [...o.checks, ...ownChecks], ownChecks, base, baseSha: gathered.baseSha, dir: o.dir ?? o.config.hum.itemsDir, kindName, kind, judge, id, item, branch, clone, evidence, env, readyFailure, g, git, answered, ownerAnswers, resume: asking, timedOut, restarted: isFresh, outbox };

			/* A change already finished lands again from its pushed branch; no run is spent on it. One saved at the owner's approval wait goes on from the wait. */
			const worked = landing && !asking ? await handToPublish(driven) : await drive(driven);
			const published = await (o.publish ?? publishInProcess(o, judge, gathered))({ item: id, intents: outbox.drain(), bundle: await bundleOf(git, { branch, item: id, gathered, folder: evidence }) }, worked);
			const result = park(o, published ?? worked);

			if (doesStartOver(result)) forgetProgress(o.state, id);

			if (result.outcome === "merged") o.state.items.remove(id);

			return result;
		} finally {
			rmSync(evidence, { recursive: true, force: true });
		}
	} finally {
		await taken.giveBack();
	}
};

/** Whether the item runs again from the start after this result, so nothing its earlier runs left stands. */
export const doesStartOver = ({ outcome }: ThinResult): boolean => outcome === "moved" || outcome === "restarted";

/** The checks an item brings of its own: a split part's, which publish kept as it filed the part. */
const ownChecksOf = (state: State, id: string): string[] => {
	const part = state.parts.get(id);

	return part === undefined ? [] : [part.check];
};

/** Where a run's working copy comes from: the remote and the branch it starts on. */
export type Source = { readonly remote: string; readonly base: string };

/** What a checkout is asked for: a working copy of `source` for the item's pass, and the signal that ends the wait for one. */
type CheckoutRequest = Source & { readonly item: string; readonly signal: AbortSignal | undefined };

/** A working copy: its folder, and the environment its runs and checks add. */
export type Workspace = { readonly folder: string; readonly env: Readonly<Record<string, string>> };

/** A run's working copy, with its ready check and the call that takes it back. */
export type Checkedout = Workspace & {
	/** The working copy's ready check, run again around each run: its failure, undefined where it passes or the copy has none. */
	readonly readyFailure: () => Promise<string | undefined>;
	readonly giveBack: () => Promise<void>;
};

/**
 * Gives an item's pass its working copy, with the base branch's files and `origin/<base>`, where a restarted run
 * branch starts. A background run starts only in a repo the owner trusts, which a fresh clone is not; a slot is a
 * worktree of the owner's checkout.
 */
export type Checkout = (request: CheckoutRequest) => Promise<Checkedout>;

/**
 * Gives each of an item's runs the owner talks to its own talk copy: a working copy of the base on a branch of its own,
 * outside the run slots, kept across the item's passes, so the run's row goes on once a pass ends and holds the copy
 * alone. With `prepared`, the slot recipe's prepare has run in it first, once, as a row that runs the repo's code needs.
 */
export type TalkCopy = (request: { readonly item: string; readonly run: string; readonly prepared: boolean }) => Promise<Workspace>;

/** A fresh `git clone` in a new folder under `workDir` (a temp folder by default), removed when the pass ends. */
const clonesIn =
	(workDir: string | undefined, timeoutMs: number): Checkout =>
	async ({ remote, base }) => {
		const folder = mkdtempSync(join(workDir ?? tmpdir(), "hum-run-"));

		await gitIn(tmpdir(), { timeoutMs }).raw(["clone", "-q", "--branch", base, remote, folder]);

		return { folder, env: {}, readyFailure: async () => undefined, giveBack: async () => rmSync(folder, { recursive: true, force: true }) };
	};

/**
 * Checks out the run branch. Given `restartAt`, it starts there, whatever an earlier run left on the remote or in the
 * folder; its next push replaces the remote's. Otherwise it comes from the remote when the remote has it, from the
 * folder when only the folder does (a pass that ended before it pushed), and new from the current commit when neither
 * does. A folder and the remote that disagree throw: neither is dropped.
 */
const onRunBranch = async (git: Git, { branch, restartAt }: { readonly branch: string; readonly restartAt: string | undefined }): Promise<void> => {
	if (restartAt !== undefined) return void (await git.raw(["checkout", "-q", "-B", branch, restartAt]));

	const onRemote = (await git.raw(["ls-remote", "--heads", "origin", branch])).trim() !== "";
	const onFolder = (await git.run(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`])).code === 0;

	if (onRemote) await git.raw(["fetch", "-q", "origin", branch]);

	if (!onFolder) return void (await git.raw(onRemote ? ["checkout", "-q", "-b", branch, "FETCH_HEAD"] : ["checkout", "-q", "-b", branch]));

	await git.raw(["checkout", "-q", branch]);

	if (onRemote) await git.raw(["merge", "--ff-only", "-q", "FETCH_HEAD"]);
};

/** The options with the clock every later step reads. */
type Driven = ThinPathOptions & {
	readonly kindName: string;
	readonly judge: ModelCall;
	readonly base: string;
	readonly dir: string;
	readonly kind: Kind;
	readonly id: ItemId;
	readonly item: Item;
	readonly branch: string;
	readonly clone: string;
	/** The folder a run saves its evidence in. */
	readonly evidence: string;
	readonly env: Readonly<Record<string, string>>;
	readonly readyFailure: Checkedout["readyFailure"];
	readonly g: (args: readonly string[]) => Promise<string>;
	readonly git: Git;
	readonly answered: Answered | undefined;
	/** The owner's answers on the thread that changed the plan, which every run reads with the item. */
	readonly ownerAnswers: readonly OwnerAnswer[];
	/** The base commit the pass started from, which a landing is checked on. */
	readonly baseSha: string;
	/** What the pass asks publish to do. */
	readonly outbox: Outbox;
	/** The checks the item brings beside the repo's, which `checks` holds too; no base was meant to pass them. */
	readonly ownChecks: readonly string[];
	/** Restore the saved owner-wait snapshot instead of starting the machine. */
	readonly resume: boolean;
	/** The saved owner wait whose timeout passed with no answer: the pass restores it and fires the timeout. */
	readonly timedOut: SavedSnapshot | undefined;
	/** The run branch starts again at the base: earlier work on the item, and the plan written for it, are gone. */
	readonly restarted: boolean;
};

const drive = async (d: Driven): Promise<ThinResult> => {
	const { state, runner, config, kind, id, item, branch, clone, g, base } = d;
	const { version } = kind.machine;
	const maxFixes = config.hum.maxFixRuns;
	const result = Promise.withResolvers<ThinResult>();
	/** The pass's agent runs: the pass ends only once they have, so no run outlives it. */
	const runs = new PQueue();

	// The total over all runs is saved; the cap counts what the item spent since the owner last answered.
	const tally = tallyOf(state, id);

	if (d.answered) {
		tally.startAfresh();
		state.events.add(ownerAnswered(id, d.answered.at));
	}

	let lastFailure = "";
	let cause = "";
	let handled = "";
	let pending: Pending | undefined;
	let actor: AnyActor;

	const stuckCause = (): string | undefined => cause || lastFailure.slice(0, CARD_EXCERPT) || undefined;

	const failed = (message: string): Error => {
		cause = message;

		return new Error(message);
	};

	/** A plan or build run is placed by the files its item declares; a fix or review run by the branch's diff so far. */
	const tierFor = async (role: string) => {
		const purpose = purposeOf(config, role);

		return tierOf(placing(d), kind, { role, purpose }, PLACED_BY_DIFF[purpose] ? await changeOn(placing(d)) : declaredChange(item));
	};

	/** The paths the change touches, as last read: what a `touches` guard reads. */
	let touched: readonly string[] | undefined;

	/** Reads the paths the change touches again, after a run or before an event, so a guard reads the change as it stands. */
	const look = async (): Promise<void> => {
		touched = (await changeOn(placing(d))).paths;
	};

	const touchedNow = (): readonly string[] => {
		if (touched === undefined) throw new Error("a guard read the change's paths before hum read them");

		return touched;
	};

	/** Sends the machine an event once the change's paths are read again. */
	const send = async (type: string): Promise<void> => {
		await look();
		actor.send({ type });
	};

	/** A state's invoked run, after which the change's paths are read again, whether it ended or failed, before the machine moves on. */
	const invoked = (body: ({ signal }: { readonly signal: AbortSignal }) => Promise<void>) =>
		createAsyncLogic({
			run: async ({ signal }) => {
				try {
					return await body({ signal });
				} finally {
					await look();
				}
			},
		});

	const branchDiff = (): Promise<string> => g(["diff", ...PATCH, `origin/${base}...HEAD`]);

	const savedTalk = (): SavedTalk => state.talks.get(id) ?? { item: id };

	/** Keeps what the owner settled, over what the item kept before. */
	const keepTalk = (settled: Omit<SavedTalk, "item">): void => state.talks.put(id, { ...savedTalk(), ...settled });

	/** The item as its runs read it: its own words, then what the owner settled in its ideate and shape rows and in answers before the one this pass goes on from. */
	const talked = (): ItemText => ({ id, title: item.title, body: talkedBody(item.body, { ...savedTalk(), answers: d.ownerAnswers.filter(({ at }) => at !== d.answered?.at) }) });

	const prompt = async (role: string, change: StepKind): Promise<string> => {
		const plan = state.plans.get(id);
		const repro = state.repros.get(id);

		const parts = [roleOf(config, role), itemHeading(talked()), RUN_CONTRACTS[change]({ branch, evidence: d.evidence })];

		if (plan) parts.push(`## The approved plan (${plan.hash})\n${JSON.stringify(plan.plan, null, 2)}`);

		if (repro && change !== "repro") parts.push(`## The repro\n\`${repro.command}\` fails because of the bug. Make it pass, and leave the files the repro wrote as they are: ${repro.files.join(", ") || "it wrote none"}.`);

		if (d.answered) {
			const soFar = d.restarted
				? `## The branch so far\nIt starts again at origin/${base}: the earlier work on this item was discarded, and no file it made is here.`
				: `## The plan so far\n${d.answered.plan || "(none saved)"}\n\n## The branch so far\n${(await branchDiff()).slice(0, config.hum.diffLimit)}`;

			parts.push(`## The owner answered\n${answerText(d.answered)}\n\n${soFar}`);
		}

		if (change === "fix") parts.push(`## What to fix\n${lastFailure.slice(-config.hum.failureTail)}\nFix the cause.`);

		return parts.join("\n\n");
	};



	/** Never settles: the driver stops the actor, so the saved snapshot stays at the state it was in. */
	const pause = (outcome: ThinResult): Promise<never> => {
		result.resolve(outcome);

		return new Promise<never>(() => {});
	};

	/** The kinds reach their owner-wait state only through the over-cap event, so a run's question uses it too. */
	const ask = async (note: Pending): Promise<void> => {
		pending = note;
		await send(TOKEN_CAP);
	};

	/**
	 * Starts one agent run of the item in `place`, or takes over the one begun under its key, and hands back what it
	 * came to. A run given what it judges is answered from the item's log when the log keeps an answer to the same prompt
	 * on the same change, and that answer spends nothing again. The run's record ends only once hum took what the run
	 * came to: a run that stopped with hum, waits on the owner, or ended with no answer keeps it, so the next pass asks
	 * for the same run by its name and takes its row over.
	 */
	const launch = async (role: string, text: string, schema: JsonSchema, signal: AbortSignal, { place = { folder: clone, env: d.env }, judged, run = role }: Launch = {}): Promise<RunOutcome> => {
		const purpose = purposeOf(config, role);
		const key = state.runs.keyFor(id, run);
		const held = purpose === "build" || purpose === "fix" ? readMemory(join(clone, ".hum", "memory.md"), config.hum.memoryMaxBytes).entries : [];
		const prefix = config.hum.roles[role]?.file ?? role;
		const prompt = `${text}${memorySection(held)}`;
		const tier = await tierFor(role);
		const named = { name: runName(key), sessionId: d.newSessionId() };

		const { begun, outcome } = await runs.add(() => answerOnce(state, { key, launch: named, machineVersion: version, question: judged && { prompt, ...tier, ...judged } }, async (begun) => {
			const lease = await d.gate?.enter(prefix, signal);

			const ran = await runner
				.run({
					prompt,
					cwd: place.folder,
					env: place.env,
					...tier,
					schema,
					tokenCap: kind.tokenCap.tokens - tally.sinceAnswer(),
					name: begun.record.name,
					item: { id, title: item.title },
					talk: TALKS.has(purpose),
					// A saved id already has a transcript under it; a fresh run mints its own.
					sessionId: begun.adopted ? undefined : begun.record.sessionId,
					signal,
					onSession: (sessionId) => begun.saveSession(sessionId),
					onFirstToken: () => lease?.opened(),
				})
				.finally(() => lease?.release());

			if (!isPaused(ran)) tally.spend(ran.tokens);

			return ran;
		}));

		if (!isPaused(outcome)) begun.end(held.length === 0 ? undefined : outcome.kind === "finished" ? rulesUsed(outcome, held) : []);

		return outcome;
	};

	/**
	 * What a run came to for the item. A limit, a hold or a stop pauses the item; passing the token cap asks the owner
	 * where the state can, and ends stuck where it cannot. The owner's answer runs on past the cap, or with `stop` ends
	 * the item.
	 */
	const settle = async (outcome: RunOutcome): Promise<Finished> => {
		if (isPaused(outcome)) return pause(pauseOf(id, outcome));

		if (outcome.kind === "over-cap") {
			const why = `The run passed its token cap (${kind.tokenCap.tokens}) at ${tally.sinceAnswer()} tokens.`;

			if (!actor.getSnapshot().can({ type: TOKEN_CAP })) throw failed(why);

			await ask({ question: { text: PLAIN_QUESTIONS["over-cap"], options: Object.values(OVER_CAP_OPTIONS), detail: why }, plain: "over-cap", plan: "" });

			return new Promise<never>(() => {});
		}

		return outcome;
	};

	/** One agent run of the item in its clone, as `settle` takes what it came to. */
	const runAgent = async (role: string, text: string, schema: JsonSchema, signal: AbortSignal, judged?: Judged): Promise<Finished> => settle(await launch(role, text, schema, signal, { judged }));

	/** The owner is asked, or the run's choice stands and is listed under the choices made without them. */
	const settleNeed = async (wants: z.infer<typeof Wants>): Promise<{ asked: Pending } | { chose: string }> => {
		const reason = wants.reason ?? { kind: "unsure" as const };
		const change = await changeOn(placing(d));
		const { placement } = await placementOf(placing(d), change);

		const decision = askDecision(reason, {
			runnerVariables: d.runnerVariables,
			changedPaths: change.paths,
			level: placement.level.name,
			undoableLevels: config.hum.undoableLevels,
		});

		if (decision.action === "ask") return { asked: { ...askedQuestion({ reason, confirmed: decision.confirmed, runsWords: wants.question }), plan: wants.plan ?? "" } };

		const text = `Chose "${decision.choice}" over ${decision.over.filter((word) => word !== decision.choice).join(", ")} without you.`;
		const why = `each option touches only this change's own files, at level ${placement.level.name}`;
		const files = reason.options?.find(({ word }) => word === decision.choice)?.paths ?? [];

		await d.outbox.calls({ run: "decide", attempt: state.runs.list(id).length }).decide(id, text);
		state.choices.put(`${id}@${text}`, { item: id, text, at: d.now(), why, files });

		return { chose: text };
	};

	/** What the ready check says after a run failed: whether the slot broke beside it, or nothing where it still passes. */
	const unreadyAfter = async (): Promise<string> => {
		const unready = await d.readyFailure();

		return unready === undefined ? "" : `; the run slot's ready check fails after it too: ${unready}`;
	};

	/** A finished build or fix run's change, committed under the pull request title it wrote. */
	const finishChange = async (role: string, wants: Wanted | undefined, before: string): Promise<void> => {
		if (!wants?.pullRequest) throw failed(`the ${role} run ended without the pull request title hum commits its change under`);

		await keepPullRequest(d, wants.pullRequest);

		if (!(await commitRun(d.git, { since: before, subject: wants.pullRequest.title }))) throw failed(`the ${role} run succeeded and changed nothing`);
	};

	/**
	 * A finished repro run's check, committed under a subject of hum's and saved with the files it touched. A repro run
	 * again, as on a branch started over, keeps the owner's window as passed while it names the same command, so only a
	 * changed repro opens the window again.
	 */
	const finishRepro = async (wants: Wanted | undefined, before: string): Promise<void> => {
		if (!wants?.repro) throw failed("the repro run ended without the command that shows the bug");

		await commitRun(d.git, { since: before, subject: `hum: ${id} repro` });

		const { command, translated } = wants.repro;
		const commit = (await g(["rev-parse", "HEAD"])).trim();
		const files = await filesBetween(d.git, before, commit);
		const earlier = state.repros.get(id);

		state.repros.put(id, { item: id, command, translated, commit, files, unopposed: earlier?.command === command ? earlier.unopposed : undefined });
	};

	/** A build run starts only once the owner's window to object to the repro closed, so a pass that starts over passes the window by. */
	const keepUnopposed = (): void => {
		const saved = state.repros.get(id);

		if (saved !== undefined && saved.unopposed === undefined) state.repros.put(id, { ...saved, unopposed: true });
	};

	/** Whether the branch already holds the item's saved repro, as on a pass that starts the machine over on the same branch. */
	const isReproduced = async (): Promise<boolean> => {
		const saved = state.repros.get(id);

		return saved !== undefined && (await isAncestor(d.git, { ancestor: saved.commit, descendant: "HEAD" }));
	};

	/** A run of `role` that changes files: a build or a fix of the change, or the repro's check. */
	const step = (role: string, change: StepKind) =>
		invoked(async ({ signal }) => {
			/* An answer at the repro's wait objects to it, so a new repro run reads the owner's words. */
			if (change === "repro" && !d.answered && (await isReproduced())) return;

			if (change === "build") keepUnopposed();

			const unready = await d.readyFailure();

			if (unready !== undefined) throw failed(`the run slot's ready check fails before the ${role} run, so no run starts: ${unready}`);

			const before = (await g(["rev-parse", "HEAD"])).trim();
			const chosen: string[] = [];

			for (;;) {
				/* Every fix run since the owner last answered counts, over every pass and wake and each run again after a choice hum made: the item's log holds them all. */
				if (change === "fix" && fixRunsOf(config, foldItem(state.events.list(id))) >= maxFixes) throw failed(`the checks still fail after ${maxFixes} fixes`);

				const outcome = await runAgent(role, `${await prompt(role, change)}${chosenSection(chosen)}`, RUN_SCHEMA, signal);

				if (!hasSucceeded(outcome)) throw failed(`the ${role} run ended as ${outcome.subtype}: ${outcome.text.slice(0, CARD_EXCERPT)}${await unreadyAfter()}`);

				const wants = Wants.safeParse(outcome.structured).data;

				if (wants?.status !== "needs-owner") return change === "repro" ? finishRepro(wants, before) : finishChange(role, wants, before);

				await commitRun(d.git, { since: before, subject: `hum: ${id} so far` });

				const settled = await settleNeed(wants);

				if ("asked" in settled) return ask(settled.asked);

				chosen.push(settled.chose);
			}
		});

	const checkOptions = { env: d.env, ...checkLimits(config.hum) };

	/** A failure a fix run reads, as the error that sends the machine to it. */
	const failedCheck = (failure: string): Error => {
		lastFailure = failure;

		return new Error(failure.slice(0, ERROR_EXCERPT));
	};

	/** Runs `body` with the clone's files at `commit`, then puts the run branch back. */
	const atCommit = async <T>(commit: string, body: () => Promise<T>): Promise<T> => {
		await g(["checkout", "-q", "-f", "--detach", commit]);

		try {
			return await body();
		} finally {
			await g(["checkout", "-q", "-f", branch]);
		}
	};

	/** Whether the base the pass started from fails `command` too, run in the clone itself so it reads what the change's checks read. */
	const failsOnBase = async (command: string): Promise<boolean> => (await atCommit(d.baseSha, () => firstFailing([command], clone, checkOptions))) !== undefined;

	/** The item's repro as its run saved it; a state that proves a repro the machine never ran is a broken kind. */
	const savedRepro = (): SavedRepro => {
		const saved = state.repros.get(id);

		if (saved === undefined) throw failed("no repro is saved for the item: its kind proves a repro its machine never ran");

		return saved;
	};

	/** The repro's command run `fixProofRuns` times where the clone stands: each run's failure, undefined where it passed. */
	const reproRuns = async (command: string): Promise<(string | undefined)[]> => {
		const failures: (string | undefined)[] = [];

		for (let run = 0; run < config.hum.fixProofRuns; run++) failures.push(await runChecks([command], clone, { ...checkOptions, reruns: 0 }));

		return failures;
	};

	/** The repro must fail on every run where it went in before any fix; one that passes shows no bug, and the owner says how to go on. */
	const showsBug = invoked(async () => {
		const repro = savedRepro();
		const passed = (await atCommit(repro.commit, () => reproRuns(repro.command))).filter((failure) => failure === undefined).length;

		if (passed === 0 && repro.unopposed) return send(WINDOW_PASSED);

		if (passed === 0) {
			pending = { question: { text: PLAIN_QUESTIONS.objection, detail: `${repro.command} failed on all ${config.hum.fixProofRuns} runs at ${repro.commit.slice(0, SHORT_SHA)}, where only the repro is in. Reply to object, and the repro runs again with your words.` }, plain: "objection", plan: "" };

			return;
		}

		state.repros.remove(id);
		await ask({ question: { text: PLAIN_QUESTIONS.repro, detail: `${repro.command} passed on ${passed} of ${config.hum.fixProofRuns} runs at ${repro.commit.slice(0, SHORT_SHA)}, where the repro went in before any fix.` }, plain: "repro", plan: "" });
	});

	/** The fix is proven once the repro's own files are as it left them and its command passes on every run; else a fix run reads why. */
	const bugGone = invoked(async () => {
		const repro = savedRepro();
		const edited = repro.files.length === 0 ? [] : await filesBetween(d.git, repro.commit, "HEAD", ...repro.files);

		if (edited.length > 0) throw failedCheck(`The change edits the repro's own files (${edited.join(", ")}): put them back as the repro left them, and fix the bug instead.`);

		const failures = (await reproRuns(repro.command)).flatMap((failure) => (failure === undefined ? [] : [failure]));

		if (failures.length > 0) throw failedCheck(`The repro still fails on ${failures.length} of ${config.hum.fixProofRuns} runs:\n${failures[0]}`);

		state.repros.put(id, { ...repro, proven: config.hum.fixProofRuns });
	});

	/** Where the base takes only signed commits, a file the change keeps whose mode GitHub's API cannot carry goes to a fix run, before publish refuses the change. */
	const carriedOrFix = async (): Promise<void> => {
		const file = (d.signs ?? (await signsCommits({ pulls: d.pulls, base }))) ? await uncarriedChange(d.git, "HEAD", d.baseSha) : undefined;

		if (file !== undefined) throw failedCheck(uncarriedFailure(base, file));
	};

	/** A failing check goes to a fix run, unless it is one of the repo's and the base fails it too: no change of the item's can pass it, so the item ends for the owner. */
	const checksSource = invoked(async () => {
		const failed = await firstFailing(d.checks, clone, checkOptions);

		if (failed === undefined) return carriedOrFix();

		if (!d.ownChecks.includes(failed.command) && (await failsOnBase(failed.command))) return pause({ outcome: "stuck", item: id, detail: `${failed.command} fails on ${base} too, at ${d.baseSha.slice(0, SHORT_SHA)}: no change of this item can pass it until ${base} does` });

		throw failedCheck(failed.failure);
	});

	const ownerQuestion = (pick: EventPick) => {
		pending = { question: { text: pick.question || pick.reason }, plain: "unsure", plan: "" };
	};

	/** What a taken pick leaves behind before the machine moves on. */
	const PICKED = new Map<string, (pick: EventPick, models: readonly string[]) => void>([
		["plan-ready", (pick, models) => pick.plan && state.plans.put(id, { item: id, plan: pick.plan, hash: planHash(pick.plan), models: [...models] })],
		["plan-blocked", ownerQuestion],
		["needs-owner", ownerQuestion],
		[
			REQUEST_CHANGES,
			(pick) => {
				lastFailure = requestedChanges(pick);
			},
		],
	]);

	/**
	 * A plan or review state: its run picks the next event, and a split files the parts and lands the item as done. The
	 * engine's own plan and review roles keep their picks, and the review its verdict, which a later review of the same
	 * change carries; a repo's role of either purpose only picks, so no verdict of its stands for the review's or comes
	 * from it. A run in the clone that only judges leaves the clone as it found it.
	 */
	const decision = (role: string, purpose: ProsePurpose) =>
		invoked(async ({ signal }) => {
			const isOwn = role === purpose;
			const isReview = purpose === "review" && isOwn;
			const diff = purpose === "review" ? await branchDiff() : "";
			const head = (await g(["rev-parse", "HEAD"])).trim();
			const patch = isReview ? await patchOf(placing(d)) : undefined;
			const carried = isReview ? await carriedVerdict(placing(d), state.verdicts.get(id), { head, patch }) : undefined;

			if (carried?.event === REVIEW_APPROVAL) {
				state.verdicts.put(id, carried);

				return send(carried.event);
			}

			const read = purpose === "review" ? await readReviewFiles(d.git, `origin/${base}`, item, config.hum) : NO_REVIEW_FILES;

			if (!read.ok) throw failed(read.why);

			const left = await changedFiles(d.git);

			const { pick, models } = await decideProse({
				purpose,
				prompt: PROSE_PROMPTS[purpose](config, talked(), diff, role, read.files),
				diff,
				model: (await tierFor(role)).model,
				run: async (text, schema) => {
					const key = state.runs.keyFor(id, role);
					const answered = await runAgent(role, text, schema, signal, { head });

					if (isReview) keepReview(state, { item: id, head, diff, run: key, outcome: answered, at: d.now() });

					return answered;
				},
				canTake: (type) => actor.getSnapshot().can({ type }),
			});

			await undoRunIn(d.git, left);

			if (isReview) keepVerdict(state, { id, head, patch, pick, models });
			else if (isOwn && purpose === "plan") keepPick(state.events, { itemId: id, pick: { judge: purpose, pick: keptPick(pick), models: [...models] } });

			PICKED.get(pick.event)?.(pick, models);

			if (pick.event === SPLIT) return result.resolve(await split(d, pick.parts));

			await send(pick.event);
		});

	/**
	 * A run the owner talks to, under its own name, in its own talk copy, whose answer must match `answer`: undefined
	 * while its row waits on the owner. Only a runner whose runs are Rail rows hosts one.
	 */
	const talk = async <Answer>(role: string, run: string, contract: string, answer: z.ZodType<Answer>, signal: AbortSignal): Promise<Answer | undefined> => {
		if (runner.talks !== true) throw failed(`the ${run} run talks with the owner, which only a Rail row can host: run hum as its roundup Project's program`);

		if (d.talkCopy === undefined) throw failed(`the ${run} run talks with the owner in a talk copy of its own, which only run slots give`);

		const head = (await g(["rev-parse", "HEAD"])).trim();
		const place = await d.talkCopy({ item: id, run, prepared: config.hum.roles[role]?.prepared === true }).catch((error: Error) => Promise.reject(failed(`the ${run} run has no talk copy: ${error.message}`)));
		const outcome = await launch(role, [roleOf(config, role), itemHeading(talked()), contract].join("\n\n"), jsonSchemaOf(answer), signal, { place, judged: { head }, run });

		if (outcome.kind === "waiting") return undefined;

		const finished = await settle(outcome);

		if (!hasSucceeded(finished)) throw failed(`the ${run} run ended as ${finished.subtype}: ${finished.text.slice(0, CARD_EXCERPT)}`);

		const read = answer.safeParse(finished.structured);

		if (!read.success) throw failed(`the ${run} run's answer does not match its contract: ${read.error.message.slice(0, CARD_EXCERPT)}`);

		return read.data;
	};

	/** The pass ends while the owner's rows hold the talk; the item sleeps until one of them needs hum. */
	const waitOnOwner = (): Promise<never> => pause({ outcome: "waiting", item: id });

	/** The ideate state: the owner talks with its row until they take a work order, which the item keeps, so a kept order runs nothing again. */
	const ideate = (role: string) =>
		invoked(async ({ signal }) => {
			if (savedTalk().order !== undefined) return;

			const answered = await talk(role, role, TALK_CONTRACTS.ideate(), IdeateAnswer, signal);

			if (answered === undefined) return waitOnOwner();

			keepTalk({ order: answered.order });
		});

	/** The roles whose row settles one choice with the owner. */
	const pickRoles = Object.entries(config.hum.roles).flatMap(([name, { purpose }]) => (purpose === "pick" ? [name] : []));

	/** The choices a shape run names with the owner, which the item keeps; undefined while its row waits on the owner. */
	const nameChoices = async (role: string, signal: AbortSignal): Promise<readonly BuildChoice[] | undefined> => {
		const answered = await talk(role, role, TALK_CONTRACTS.design(pickRoles), choicesAnswer(pickRoles), signal);

		if (answered !== undefined) keepTalk({ choices: answered.choices });

		return answered?.choices;
	};

	/** The owner's pick on the choice at `at`, settled in a row of the role it names, under a name of its own, which the item keeps; false while that row waits on the owner. */
	const pickFor = async (choice: BuildChoice, at: number, signal: AbortSignal): Promise<boolean> => {
		if (choice.role === undefined) throw failed(`the choice "${choice.title}" names neither the owner's pick nor a role whose row settles it`);

		const picked = await talk(choice.role, `${choice.role} ${at + 1}`, TALK_CONTRACTS.pick(choice), PickAnswer, signal);

		if (picked !== undefined) keepTalk({ choices: savedTalk().choices?.map((kept, index) => (index === at ? { ...kept, ...picked } : kept)) });

		return picked !== undefined;
	};

	/**
	 * The shape state: the owner talks with its row until it names every choice the build depends on, then each choice
	 * still open runs a row of the role it names, side by side, and the state ends once every choice carries the owner's
	 * pick. Once every open choice's row started, the pass ends while one waits on the owner; a row that fails ends the
	 * state, and the picks the others settle stay. Choices and picks the item kept run nothing again.
	 */
	const design = (role: string) =>
		invoked(async ({ signal }) => {
			const choices = savedTalk().choices ?? (await nameChoices(role, signal));

			if (choices === undefined) return waitOnOwner();

			const settled = await Promise.allSettled(choices.map((choice, at) => (choice.pick === undefined ? pickFor(choice, at, signal) : true)));
			const failure = settled.find((one) => one.status === "rejected");

			if (failure !== undefined) throw failure.reason;

			if (settled.some((one) => one.status === "fulfilled" && !one.value)) return waitOnOwner();
		});

	/** A pick role's row runs only for a choice a shape run named. */
	const pickOnly = invoked(async () => {
		throw failed("a state invokes a pick role, whose row runs only for a choice a shape run named");
	});

	/** A run for each role, by its purpose: a plan or review role picks the next event; a build or fix role changes the files; ideate and shape talk with the owner. */
	const SOURCES = {
		plan: (role: string) => decision(role, "plan"),
		review: (role: string) => decision(role, "review"),
		build: (role: string) => step(role, "build"),
		fix: (role: string) => step(role, "fix"),
		ideate,
		design,
		pick: () => pickOnly,
	} satisfies Record<Purpose, (role: string) => AnyActorLogic>;

	/** The repro role writes the repro's check; every other role runs by its purpose. */
	const roleSource = (role: string) => (role === REPRO_ROLE ? step(role, "repro") : SOURCES[purposeOf(config, role)](role));

	/** Anything else a state invokes runs nothing: the config check refuses it, and a pass that meets one anyway fails loud. */
	const nothingRuns = invoked(async () => {
		throw failed("a state invokes a source that is neither a role nor a part that runs");
	});

	const sources = { ...Object.fromEntries(Object.keys(config.hum.roles).map((role) => [role, roleSource(role)])), checks: checksSource, "shows-bug": showsBug, "bug-gone": bugGone };

	const reads = { touched: touchedNow, talks: runner.talks === true };

	/** A wait that timed out restores on a clock that keeps its timers, so the pass fires the due ones with the real sources. */
	const due = d.timedOut === undefined ? undefined : dueClock(state, { kind, saved: d.timedOut }, d.now());

	if (d.resume) {
		const restored = await state.items.restore(id, kind, { sources: invokedSources(kind, nothingRuns, sources), kindAt: earlierKinds(state, kind), clock: due?.clock, reads });

		if (!restored.ok) return { outcome: "held", item: id, why: restored.fault.cause };

		if (!restored.value) return { outcome: "held", item: id, why: `the saved state of ${id} vanished` };

		actor = restored.value;
		// The wait it was saved in is already handled; only what follows the answer needs a reaction.
		handled = String(actor.getSnapshot().value);
	} else actor = createActor(kindMachine(kind, invokedSources(kind, nothingRuns, sources), reads));

	/** Where the machine stood at its last save, and the states it has left since it started: a restored wait goes on with its saved record. */
	let at = d.resume ? String(actor.getSnapshot().value) : undefined;
	let passed = d.resume ? state.items.savedOf(id)?.passed : [];

	const react = async (value: string) => {
		if (handled === value) return;

		handled = value;

		if (hasEndedStuck(kind, value)) return result.resolve({ outcome: "stuck", item: id, detail: stuckCause() });

		if (isWaitingOnOwner(kind, value)) {
			const note = withTimeoutNote(kind, value, pending ?? { question: { text: "The run stopped for the owner." }, plain: "unsure" as const, plan: "" });

			pending = undefined;

			const approval = isApprovalWait(kind, value);
			const stopped = await handOff(d, approval ? approvalQuestion(note) : note, { approval });

			return result.resolve(stopped ?? { outcome: "asked", item: id, detail: note.question.text });
		}

		if (value === "merging") return result.resolve(await merge(d));
	};

	actor.subscribe({
		next: (snapshot) => {
			const value = String(snapshot.value);

			passed = passedOnto(passed, at, value);
			at = value;

			const saved = state.items.save(id, kind, persistedSnapshot(actor), passed);

			if (!saved.ok) result.reject(new Error(saved.fault.cause));

			if (snapshot.status === "done") {
				state.items.remove(id);

				return result.resolve({ outcome: "merged", item: id });
			}

			react(String(snapshot.value)).catch((error) => result.reject(error));
		},
		/* A machine that fails, as a guard that throws does, ends the pass in its error instead of leaving it waiting. */
		error: (error) => result.reject(error),
	});

	await look();

	/* A signal aborted already never calls its listener, so a pass the worker stopped before here ends lost before its machine starts a run. */
	if (d.signal?.aborted) return { outcome: "lost", item: id };

	d.signal?.addEventListener("abort", () => result.resolve({ outcome: "lost", item: id }), { once: true });

	if (!d.resume) state.events.add(machineStarted({ itemId: id, machineVersion: version, afresh: d.restarted }));

	actor.start();

	if (d.answered && d.resume) {
		const resume = resumeEvent(kind, String(actor.getSnapshot().value), d.answered);

		if (resume === OWNER_REJECTED) lastFailure = d.answered.answer;

		actor.send({ type: resume });
	} else due?.fireDue();

	return result.promise.finally(async () => {
		actor.stop();
		await runs.onIdle();
	});
};

/** An owner wait whose timeout goes on to work, not to stuck, tells the owner when it goes on without them. */
const withTimeoutNote = (kind: Kind, state: string, note: Pending): Pending => {
	const timeout = earliestTimeout(kind.machine.states[state]);
	const target = timeout?.transitions[0]?.target;

	if (timeout === undefined || target === undefined || hasEndedStuck(kind, target)) return note;

	const told = `With no reply within ${timeout.hours} hours, the item goes on to ${target}.`;

	return { ...note, question: { ...note.question, detail: [note.question.detail, told].filter(Boolean).join(" ") } };
};

const EXECUTABLE = "100755";

/** What a fix run reads when the change keeps a file whose mode `base`'s signed commits cannot carry: how to keep the file plain. */
const uncarriedFailure = (base: string, { path, mode }: Uncarried): string => {
	const fix = mode === EXECUTABLE ? `Drop its executable bit (\`chmod -x ${path}\`) and call it through its interpreter wherever the change runs it, as \`bash ${path}\` for a shell script.` : "Put a plain file in its place.";

	return `${path} has mode ${mode}, which ${base}'s signed commits cannot carry: GitHub's API makes them, and it writes no executable bit, link or submodule. ${fix}`;
};

/**
 * Commits what a run left in the working tree as one commit on `since`, under `subject`, by the owner's
 * commitIdentity, and says whether there was a change to commit. A commit the run made anyway, and the work so far
 * hum committed when the run asked, are folded into it, so the run's whole change is one commit of hum's.
 */
const commitRun = async (git: Git, { since, subject }: { readonly since: string; readonly subject: string }): Promise<boolean> => {
	await git.raw(["reset", "-q", "--soft", since]);
	await git.raw(["add", "-A"]);

	if ((await git.run(["diff", "--cached", "--quiet"])).code === 0) return false;

	await git.raw(["commit", "-q", "--no-verify", "-m", subject]);

	return true;
};

/** Saves the pull request a run wrote, with its evidence kept where GitHub shows it; evidence an earlier run kept stays when this run names none. */
const keepPullRequest = async (d: Driven, { title, body, evidence }: PullRequestWritten): Promise<void> => {
	const kept = evidence === undefined ? d.state.pullRequests.get(d.id)?.evidence : await keepEvidence({ git: d.git, folder: d.evidence, file: evidence, item: d.id, repo: repoFromRemote(d.remote) });

	if (evidence !== undefined && kept !== undefined && "url" in kept) d.outbox.add({ kind: "keep-evidence" });

	d.state.pullRequests.put(d.id, { item: d.id, title, body, evidence: kept });
};

/** What a run left for the owner: the question, the plain one it falls back to, and the plan so far. */
type Pending = { readonly question: Question; readonly plain: PlainQuestion; readonly plan: string };

const chosenSection = (chosen: readonly string[]): string => (chosen.length === 0 ? "" : `\n\n## Decided without the owner\n${chosen.map((text) => `- ${text}`).join("\n")}\nGo on with these choices.`);

/** The event an owner's answer sends the saved wait: the approval of a change where the wait takes it and the answer approves, else the wait's written answer. */
const resumeEvent = (kind: Kind, state: string, answered: Answered): string => {
	if (isApprovalWait(kind, state) && answered.option === OWNER_APPROVAL) return OWNER_APPROVED;

	const textEvent = interactionAt(kind, state)?.textEvent;

	if (textEvent === undefined) throw new Error(`${kind.machine.id}: the wait "${state}" takes no written answer`);

	return textEvent;
};

type Purpose = (typeof PURPOSES)[number];

/** Which runs are placed by the branch's diff so far; the others by the files their item declares. */
const PLACED_BY_DIFF = { plan: false, build: false, fix: true, review: true, ideate: false, design: false, pick: false } as const satisfies Record<Purpose, boolean>;

/** The purposes of runs the owner talks to. */
const TALKS: ReadonlySet<Purpose> = new Set(TALK_PURPOSES);

/**
 * What a plan or review run reads besides its prompt: the commit its clone stands at, which fixes the whole diff its
 * prompt may cut short. Only these runs are given it: their answer is all they do, while a build or fix run's change
 * lives in a clone that a kill loses.
 */
type Judged = { readonly head: string };

/** Where a run works, what it judges, and the name it runs under, past its role's own: the clone, nothing, and its role by default. */
type Launch = { readonly place?: Workspace; readonly judged?: Judged; readonly run?: string };

/** What a run reads from its config: the settings and the role files. */
export type RunConfig = Pick<Config, "hum" | "roles">;

/** The item's heading and words, as every run's prompt quotes them. */
const itemHeading = ({ id, title, body }: ItemText): string => `# Item ${id}: ${title}\n\n${body}`;

/** A role's file, then the skills it names, so the run reaches for them. */
const roleOf = (config: RunConfig, name: string): string => {
	const role = config.hum.roles[name];
	const text = ((role && config.roles[role.file]) ?? "").trim();
	const skills = role?.skills ?? [];

	return skills.length === 0 ? text : [text, `Use these skills with the Skill tool where they apply: ${skills.join(", ")}.`].filter(Boolean).join("\n\n");
};


/**
 * What a plan or review run is told. The review's prompt quotes only the item, the files named for its review and the
 * diff, so no author's reasoning reaches it through the prompt.
 */
export const PROSE_PROMPTS = {
	plan: (config: RunConfig, item: ItemText, _diff = "", role = "plan"): string =>
		[
			roleOf(config, role),
			itemHeading(item),
			"Plan the change: read the repo, edit nothing. A plan-ready answer holds the plan; a needs-split answer names each part: its title, the files it may touch, the earlier parts it waits on by their place in the list from 1, and the one command that proves it; a plan-blocked answer asks the owner one question.",
		].join("\n\n"),
	review: (config: RunConfig, item: ItemText, diff: string, role = REVIEW_ROLE, files: readonly ReadFile[] = []): string => [roleOf(config, role), reviewInput(item, diff, config.hum, files)].join("\n\n"),
} as const satisfies Record<ProsePurpose, (config: RunConfig, item: ItemText, diff: string, role?: string, files?: readonly ReadFile[]) => string>;

/** A pick as the item's log keeps it: a split's parts by title, which is all a measure reads of them. */
const keptPick = (pick: EventPick) => ({ ...pick, parts: pick.parts.map(({ title }) => title) });

/** A review's verdict on the change that ends at `head`: saved for landing, and kept in the item's log. */
const keepVerdict = (state: State, { id, head, patch, pick, models }: { readonly id: string; readonly head: string; readonly patch: string | undefined; readonly pick: EventPick; readonly models: readonly string[] }) => {
	const verdict = { item: id, head, patch, event: pick.event, reason: pick.reason, cites: pick.cites, models: [...models] };

	state.verdicts.put(id, verdict);
	keepPick(state.events, { itemId: id, pick: { judge: "review", head, pick: keptPick(pick), models: [...models] } });

	return verdict;
};

/** What a repro that still shows the bug sends where the owner's window to object to it already closed. */
const WINDOW_PASSED = "window-passed";

/** What a run that changes files makes: a build or a fix of the change, or the repro's check. Each leaves it in the working tree, which hum commits. */
type StepKind = "build" | "fix" | "repro";

/** The engine's own review role: the review at landing runs it too, as a call with no tool that reads only the item, the files named for its review and the diff. */
const REVIEW_ROLE = "review";

/** The engine's own repro role, whose run writes the check that shows the bug. */
const REPRO_ROLE = "repro";

/** The fix runs whose answers the item's log keeps since the owner last answered: each run of a role whose purpose is fix. */
const fixRunsOf = ({ hum }: RunConfig, { runs }: ItemFold): number =>
	Object.entries(runs).reduce((total, [role, count]) => total + (hum.roles[role]?.purpose === "fix" ? count : 0), 0);

/** The files git sees changed in a working copy: tracked ones that differ from HEAD, and untracked ones it does not ignore. */
const changedFiles = async (git: Git): Promise<ReadonlySet<string>> => {
	const [tracked, untracked] = await Promise.all([git.raw(["diff", "--name-only", "-z", "HEAD"]), git.raw(["ls-files", "--others", "--exclude-standard", "-z"])]);

	return new Set([...tracked.split("\0"), ...untracked.split("\0")].filter(Boolean));
};

/** Undoes what a run changed in the working copy since `before` was read: a tracked file goes back to HEAD, and a file the run added goes. */
const undoRunIn = async (git: Git, before: ReadonlySet<string>): Promise<void> => {
	const made = [...(await changedFiles(git))].filter((file) => !before.has(file));

	if (made.length === 0) return;

	const tracked = new Set((await git.raw(["ls-files", "-z", "--", ...made])).split("\0").filter(Boolean));
	const restored = made.filter((file) => tracked.has(file));
	const added = made.filter((file) => !tracked.has(file));

	if (restored.length > 0) await git.raw(["checkout", "-q", "HEAD", "--", ...restored]);

	if (added.length > 0) await git.raw(["clean", "-q", "-f", "--", ...added]);
};

/** Where a run that changes files works, and the folder it saves its evidence in. */
type Workplace = { readonly branch: string; readonly evidence: string };

/** How a run that drives the app proves its change, and what it reports where it cannot. */
const PROOF_RULES = [
	"Where you drive the app to prove the change, prove each way into the changed behavior you know of; never count a skipped one as proven through another.",
	"A way in you cannot reach goes in the pull request, with the command you tried and what it lacked.",
	"When the app does not behave as you expect, decide first whether your drive, the setup or the product is wrong; a product fault the item did not ask about goes in the pull request, never edited away.",
	"Stop only what this run started, after each failed attempt too, and keep the proof files.",
].join(" ");

const pullRequestContract = ({ branch, evidence }: Workplace): string =>
	[
		`Work on the branch ${branch}. Leave the change in the working tree and make no commit: hum commits every file there once you are done. End with the JSON {"status":"done"}, or {"status":"needs-owner","question":…,"plan":…} when only the owner can answer.`,
		`With "done", give "pullRequest": the title and body of the pull request that lands the branch's whole change, written as this repo's own rules ask a pull request to be; hum commits your change under its title. Where one screenshot or short video shows the change at work, save that one file in ${evidence}, never in the repo, and give its file name as "pullRequest.evidence".`,
		PROOF_RULES,
	].join("\n\n");

/** How a run the owner talks to asks them. */
const ASK_IN_ROW = "The owner talks with you in this row: ask each question with your AskUserQuestion tool, and wait for their answer.";

/** What each run the owner talks to is told about its answer, by its purpose. */
const TALK_CONTRACTS = {
	ideate: () => `${ASK_IN_ROW} End once the owner took a work order, with the JSON {"order":{"title":…,"ask":…,"done":…,"limits":[…]}}: the order as they took it, each limit a rule that reads on its own.`,
	design: (pickRoles: readonly string[]) =>
		`${ASK_IN_ROW} End with the JSON {"choices":[…]}, one entry per choice the build depends on, each with a "title" and a "detail" of what the owner weighs. A choice the owner picked with you here carries their "pick"; every other choice names in "role" the row that settles it, one of: ${pickRoles.join(", ") || "none, so settle every choice here"}. hum starts those rows once you answer, and planning starts only once every choice carries the owner's pick.`,
	pick: ({ title, detail }: BuildChoice) =>
		`## The choice\n\n${title}: ${detail}\n\n${ASK_IN_ROW} Settle this one choice: show the owner what you found, then let them pick. End with the JSON {"pick":…,"found":…}: the option the owner picked, and what you found or measured that the pick rests on.`,
} as const satisfies Record<(typeof TALK_PURPOSES)[number], (...args: never[]) => string>;

/** What each run that changes files is told about its answer: a build or fix run writes the pull request, a repro run names its check. */
const RUN_CONTRACTS = {
	build: pullRequestContract,
	fix: pullRequestContract,
	repro: ({ branch }) =>
		`Work on the branch ${branch}. Leave the check in the working tree and make no commit: hum commits it once you are done. End with the JSON {"status":"done","repro":{"command":…}}, naming the one shell command that fails now because of the bug and will pass once it is fixed, with "repro.translated" saying what stood in where the reported environment was not at hand; or {"status":"needs-owner","question":…,"plan":…} when only the owner can answer.`,
} as const satisfies Record<StepKind, (where: Workplace) => string>;

/** The purpose a role runs for, which picks its tier: the config's, else the role's own name for one of the four purposes. */
const purposeOf = (config: RunConfig, role: string): Purpose => config.hum.roles[role]?.purpose ?? z.enum(PURPOSES).parse(role);

/** What a paused run comes to for its item. */
const pauseOf = (id: string, outcome: Paused): ThinResult => {
	switch (outcome.kind) {
		case "limited":
			return { outcome: "limited", item: id, until: outcome.until };
		case "held":
			return { outcome: "held", item: id, why: outcome.card.cause };
		case "stopped":
			return { outcome: "lost", item: id };
		case "waiting":
			return { outcome: "waiting", item: id };
	}
};

/**
 * A fresh review at landing, for a level that asks for one: a model call with no tool, which reads only the item, the
 * files named for its review and the diff, and whose verdict is saved. Publish makes it, so no verdict comes from the
 * side that wrote the change.
 */
export const reviewRunOf =
	(o: Pick<ThinPathOptions, "runner" | "state" | "config" | "now">, item: Item, kindName: string) =>
	async ({ head, diff, level, patch, files }: Parameters<LandContext["reviewRun"]>[0]): Promise<ReviewOutcome> => {
		const kind = kindNamed(o.config, kindName);
		const row = pickTier(kind, { role: REVIEW_ROLE, purpose: "review", level, size: "small" });

		if (!row) throw new Error(`the ${kindName} table has no review row`);

		const tally = tallyOf(o.state, item.id);

		let halt: (result: ThinResult) => void = () => {};

		const halted = new Promise<ReviewOutcome>((resolve) => {
			halt = (result) => resolve({ halted: result });
		});

		/** A run with no answer never settles, as AnswerRun requires; the review comes to `halted` instead. */
		const run = async (prompt: string, schema: JsonSchema): Promise<Finished> => {
			const outcome = await o.runner.run({ prompt, cwd: tmpdir(), call: "judgment", model: o.config.hum.models[row.tier], effort: row.effort, schema, tokenCap: kind.tokenCap.tokens - tally.sinceAnswer() });

			if (outcome.kind === "finished") {
				tally.spend(outcome.tokens);
				keepReview(o.state, { item: item.id, head, diff, outcome, at: o.now() });

				return outcome;
			}

			if (outcome.kind === "over-cap") tally.spend(outcome.tokens);

			halt(isPaused(outcome) ? pauseOf(item.id, outcome) : { outcome: "review", item: item.id, detail: `the review run passed the item's token cap (${kind.tokenCap.tokens}) at ${tally.sinceAnswer()} tokens` });

			return new Promise<never>(() => {});
		};

		const decided = decideProse({ purpose: "review", prompt: PROSE_PROMPTS.review(o.config, item, diff, REVIEW_ROLE, files), diff, model: o.config.hum.models[row.tier], run }).then(({ pick, models }): ReviewOutcome => ({ verdict: keepVerdict(o.state, { id: item.id, head, patch, pick, models }) }));

		return Promise.race([decided, halted]);
	};

/** Publish's root for the passes of `o`: the worker's own adapters, its claim, and a repo of publish's own beside the state. */
export const publisherOf = (
	o: Pick<ThinPathOptions, "state" | "config" | "workSource" | "questions" | "pulls" | "commits" | "runner" | "holder" | "now" | "remote" | "base" | "dir">,
	judge: ModelCall,
	mergesBefore?: number,
): Publisher => ({
	state: o.state,
	config: o.config,
	workSource: o.workSource,
	questions: o.questions,
	pulls: o.pulls,
	commits: o.commits,
	judge,
	reviewRun: (item, kindName) => reviewRunOf(o, item, kindName),
	kindOf: (item) => o.state.itemKinds.get(item.id)?.kind ?? o.config.hum.fallbackKind,
	holder: o.holder,
	now: o.now,
	remote: o.remote,
	base: o.base ?? DEFAULT_BASE,
	dir: o.dir ?? o.config.hum.itemsDir,
	repo: join(o.state.dir, PUBLISH_REPO),
	mergesBefore,
	save: async () => undefined,
});

/** Publishes a pass in the worker's own process, against what the pass's checkout saw before any run. */
const publishInProcess =
	(o: ThinPathOptions, judge: ModelCall, gathered: GatherTrust) =>
	(pass: PassOutbox): Promise<ThinResult | undefined> =>
		publishPass(publisherOf(o, judge), gathered, pass);

/** What the checkout saw before any run: the base commit and the run branch's head on the remote. */
const gatheredIn = async (git: Git, { base, branch }: { readonly base: string; readonly branch: string }): Promise<GatherTrust> => ({
	baseSha: (await git.raw(["rev-parse", `origin/${base}`])).trim(),
	heads: Object.fromEntries((await git.raw(["ls-remote", "--heads", "origin", branch])).split("\n").flatMap((line) => line.split("\t", 1).filter(Boolean).map((sha) => [branch, sha] as const))),
});

/** The bundle of the refs a pass made, the run branch and its evidence, with only what gather did not see; undefined when the pass made nothing new. */
const bundleOf = async (git: Git, { branch, item, gathered, folder }: { readonly branch: string; readonly item: string; readonly gathered: GatherTrust; readonly folder: string }): Promise<string | undefined> => {
	const known = [gathered.baseSha, ...Object.values(gathered.heads)];
	const refs = (await Promise.all([`refs/heads/${branch}`, evidenceRef(item)].map(async (ref) => ((await git.run(["rev-parse", "--verify", "--quiet", ref])).code === 0 ? [ref] : [])))).flat();
	const fresh = refs.length === 0 ? 0 : Number((await git.raw(["rev-list", "--count", ...refs, "--not", ...known])).trim());

	if (fresh === 0) return undefined;

	const file = join(folder, "pass.bundle");

	await git.raw(["bundle", "create", "-q", file, ...refs, "--not", ...known]);

	return file;
};

/**
 * Files each part of a split item as its own item, with the files it may touch, which the scheduler reads, and its
 * check; publish names the parts it waits on. Then the item lands as done with no change of its own.
 */
const split = async (d: Driven, parts: readonly SplitPart[]): Promise<ThinResult> => {
	const writes = d.outbox.calls({ run: SPLIT, attempt: 0 });

	for (const { title, touches, waitsOn, check } of parts) await writes.fileFollowUp(d.id, { title, body: `Split from ${d.id}: ${d.item.title}\n\ntouches: ${touches.join(", ")}\ncheck: ${check}` }, { waitsOn, check });

	return merge(d);
};

/** The owner-review wait asks for the change's approval, whatever the review run wrote. */
const approvalQuestion = ({ question, plan }: Pending): Pending => ({
	question: { text: PLAIN_QUESTIONS["owner-review"], detail: question.detail ?? question.text },
	plain: "owner-review",
	plan,
});

/**
 * Hands the work branch and the plan to publish, queues the question for room under the daily cap, and ends. At the
 * owner's approval wait publish saves the change as the item's landing before it asks, so the approval the owner
 * gives counts for this change alone.
 */
const handOff = async (d: Driven, { question, plain, plan }: Pending, { approval }: { readonly approval: boolean }): Promise<undefined> => {
	const { state, id } = d;
	const attempt = state.runs.list(id).length;
	const head = (await d.g(["rev-parse", "HEAD"])).trim();

	d.outbox.add(approval ? { kind: "save-landing", head } : { kind: "push-branch", head });

	if (plan.trim()) await d.outbox.calls({ run: "ask", attempt }).comment(id, `${PLAN_MARK}\n${plan.trim()}`);

	queueQuestion(d, d.item, question, plain);

	return undefined;
};

/** What the work side reads to place a change: the policy, the base's history and the change's own diff. */
const placing = (d: Driven) => ({ state: d.state, config: d.config, git: d.git, base: d.base, now: d.now, kind: d.kindName, dir: d.dir, id: d.id });

const DRAINING = "the worker restarts for an update; the next worker lands the change under its config";

/** Publish decides the landing; the pass's own word on it is that publish has it. */
const LANDING_HANDED: string = "publish lands the change";

/**
 * Hands the change at `merging` to publish, once it grows from the base the pass started on and the checks pass
 * there, unless the worker drains. A check item proves its check first. A docs-only item whose change reaches past
 * its globs moves to its real kind first.
 */
const merge = async (d: Driven): Promise<ThinResult> => {
	if (d.kindName === d.config.hum.checkKind) {
		const proof = await proveCheckItem({ state: d.state, config: d.config, git: d.git, item: d.id, base: d.base, checks: d.checks, now: d.now });

		if (proof && !proof.passed) return { outcome: "stuck", item: d.id, detail: proof.reason };
	}

	const isDocsOnly = d.kindName === d.config.hum.docsOnly.kind;

	if (isDocsOnly && doesLeaveDocs((await changeOn(placing(d))).paths, d.config.hum)) {
		const real = keepKind(d, d.item, await pickKind(d, d.item, d.kindName), d.kindName);

		return { outcome: "moved", item: d.id, kind: real };
	}

	return handToPublish(d);
};

/** A finished change whose landing did not end: its branch is checked on the base again, and publish lands it. */
const handToPublish = async (d: Driven): Promise<ThinResult> => {
	const head = async () => (await d.g(["rev-parse", "HEAD"])).trim();

	if (d.mayLand?.() === false) {
		d.outbox.add({ kind: "save-landing", head: await head() });

		return { outcome: "held", item: d.id, why: DRAINING };
	}

	const stale = await rebaseOnto(d, d.baseSha);

	if (stale) return staleChange(d, stale);

	d.outbox.add({ kind: "land", head: await head() });

	return { outcome: "held", item: d.id, why: LANDING_HANDED };
};

/** A change that no longer holds on the newest base is built there again while rebuilds since the owner last answered are left; past them it waits for the owner. */
const staleChange = (d: Driven, why: string): ThinResult => {
	if (foldItem(d.state.events.list(d.id)).rebuilds >= d.config.hum.conflictRebuilds) return { outcome: "review", item: d.id, detail: why };

	d.state.events.add(rebuilt(d.id, why));

	return { outcome: "restarted", item: d.id, why };
};

type Parking = { readonly outcome: "stuck" | "review"; readonly item: string; readonly detail?: string };

const isParking = (result: ThinResult): result is ThinResult & Parking => result.outcome === "stuck" || result.outcome === "review";

const PARKING = {
	stuck: {
		code: "item-stuck",
		fallback: "a run failed",
		cause: (item: string, why: string) => `${item} ended stuck: ${why}`,
		fix: "Fix the cause, then run it again.",
		action: { label: "Run it again", answer: RUN_AGAIN },
		plain: "stuck",
	},
	review: {
		code: "item-review",
		fallback: "its change waits for a review",
		cause: (item: string, why: string) => `${item} is ready to merge but needs your review: ${why}`,
		fix: "Review the branch, then approve it on the item, or answer retry to run it again.",
		action: { label: "Approve", answer: OWNER_APPROVAL },
		plain: "owner-review",
	},
} as const satisfies Record<Parking["outcome"], { code: string; fallback: string; cause: (item: string, why: string) => string; fix: string; action: { label: string; answer: string }; plain: PlainQuestion }>;

/** The card on a parked item, one code for each reason it sits out. */
export const PARKED_CODES: readonly string[] = Object.values(PARKING).map(({ code }) => code);

/** An item that ended stuck, or whose change waits for a review, sits out until the owner acts. One card says why and how to run it again. */
export const park = (o: Pick<ThinPathOptions, "state" | "now">, result: ThinResult): ThinResult => {
	if (!isParking(result)) return result;

	const rule = PARKING[result.outcome];
	const cause = result.detail ?? rule.fallback;

	o.state.parked.put(result.item, { item: result.item, why: result.outcome, cause, since: o.now() });
	o.state.faults.raise({
		code: rule.code,
		item: result.item,
		cause: rule.cause(result.item, cause.slice(0, CARD_EXCERPT)),
		fix: rule.fix,
		action: rule.action,
	});

	return result;
};

/** The question a park asks where the owner answers only a question hum asked: why the item parked, and what they may answer. */
export const parkQuestion = ({ item, why, cause }: Parked) => {
	const rule = PARKING[why];

	return { question: { text: rule.cause(item, cause.slice(0, CARD_EXCERPT)), options: PARK_OPTIONS[why], detail: rule.fix } satisfies Question, plain: rule.plain };
};
