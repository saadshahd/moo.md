import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { type AnyActor, createActor, createAsyncLogic } from "xstate";
import type { Holder, Item, ItemId, Question, Questions, ThreadEntry, WorkSource } from "../adapter-api.ts";
import { type Finished, type Runner, type RunOutcome, hasSucceeded } from "../adapters/claude-p.ts";
import { configuredModelCall, type ModelCall } from "../adapters/model-call.ts";
import { ADAPTER_API_VERSION } from "../adapter-api.ts";
import { onceCalls } from "../adapters/once.ts";
import { visibleText } from "../adapters/marked.ts";
import { type Git, gitIn, identityEnv, PATCH, push } from "../adapters/git.ts";
import type { PullRequests } from "../adapters/pull-requests.ts";
import { pickTier } from "../config/checks.ts";
import type { Config } from "../config/load.ts";
import { invokedSources, kindMachine } from "../config/machine.ts";
import { type Kind, type Naming, OWNER_WAIT_TAG, type PURPOSES, STUCK_TAG } from "../config/schema.ts";
import { commandTimeoutMs } from "../exec.ts";
import { doesLeaveDocs } from "../decide/kind.ts";
import { type EventPick, type JsonSchema, jsonSchemaOf, type ProsePurpose, planHash, requestedChanges } from "../decide/prose.ts";
import { persistedSnapshot } from "../state/items.ts";
import type { State } from "../state/open.ts";
import { HOUR_MS, SECOND_MS } from "../time.ts";
import { checksTimeoutMs, runChecks } from "./checks.ts";
import { BASE_CONTENDED, changeOn, type LandContext, land, placementOf, prepareLanding, type ReviewOutcome, unpushed } from "./land.ts";
import { OWNER_APPROVAL } from "../decide/merge.ts";
import { askDecision, askedQuestion, isWaitQuestion, PLAIN_QUESTIONS, type PlainQuestion, RunReason } from "../decide/question.ts";
import type { Stage } from "../decide/answer.ts";
import { type ItemText, reviewInput } from "../decide/review.ts";
import { forgetProgress, keepKind, kindAnswered, pickKind } from "./kind.ts";
import { settleAnswers } from "./answers.ts";
import { queueQuestion, releaseQuestions } from "./questions.ts";
import { answerToLatest, latestQuestionAt, openQuestion } from "./thread.ts";
import { memorySection, readMemory, rulesUsed } from "../loop/memory.ts";
import { proveCheckItem } from "../loop/prove-item.ts";
import { tallyOf } from "./tally.ts";
import { decideProse } from "./prose-run.ts";
import { footprintOf, type PrefixGate } from "./scheduler.ts";

/** How long a claim lasts unless its holder renews it. */
export const claimTtlMs = (config: Config): number => config.hum.claimExpirySeconds * SECOND_MS;

const CARD_EXCERPT = 300;

const ERROR_EXCERPT = 500;

/** The branch runs start from when none is given. */
export const DEFAULT_BASE = "main";

export const runBranch = ({ runBranchPrefix }: Naming, id: string): string => `${runBranchPrefix}${id}`;

/** What the agent run hands back besides its commit. */
export const RUN_SCHEMA = jsonSchemaOf(z.object({ status: z.enum(["done", "needs-owner"]), question: z.string().optional(), plan: z.string().optional(), reason: RunReason.optional(), memoryUsed: z.array(z.int().positive()).optional() }));

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
	/** The names, never the values, of the variables the runs have; a missing secret is checked against them. */
	readonly runnerVariables: ReadonlySet<string>;
	/** A fresh id for each run's session. */
	readonly newSessionId: () => string;
	/** False while the worker drains for an update: a finished change is saved and pushed, and the next worker lands it under the config it starts with. */
	readonly mayLand?: () => boolean;
};

export type ThinResult =
	| { readonly outcome: "idle" }
	| { readonly outcome: "lost" | "waiting"; readonly item: string }
	/** The item's change showed it is another kind: it runs again from the start as that kind, on the same branch restarted at the base. */
	| { readonly outcome: "moved"; readonly item: string; readonly kind: string }
	| { readonly outcome: "merged" | "asked" | "stuck" | "review" | "landing"; readonly item: string; readonly detail?: string }
	| { readonly outcome: "limited"; readonly item: string; readonly until: number }
	| { readonly outcome: "held"; readonly item: string; readonly why: string };

type Answered = { readonly question: string; readonly answer: string; readonly option: string | undefined; readonly plan: string };

/** The question, the answer to it and the plan, once the owner has answered the latest question. */
export const answerTo = (item: Item): Answered | undefined => {
	const answer = answerToLatest(item.thread);

	if (!answer) return undefined;

	const plan = item.thread.findLast((e) => e.kind === "comment" && e.text.startsWith(PLAN_MARK));

	return {
		question: item.thread[latestQuestionAt(item.thread)]?.text ?? "",
		answer: answer.option ? `${answer.option}: ${answer.text}` : answer.text,
		option: answer.option,
		plan: plan?.text.slice(PLAN_MARK.length).trim() ?? "",
	};
};

/** The question the item's latest hum question puts, when it is one the item waits on and no applied answer follows it. */
const unansweredQuestion = (item: Item): ThreadEntry | undefined => {
	const question = openQuestion(item.thread);

	return question && isWaitQuestion(visibleText(question.text)) ? question : undefined;
};

/** Whether the kind's machine takes the owner's approval of a change in this state. */
const isApprovalWait = (kind: Kind, state: string | undefined): boolean => state !== undefined && kind.machine.states[state]?.on?.[OWNER_APPROVED] !== undefined;

/** Where an item saved in an owner wait stands for an answer: waiting on approval where the state takes the owner's approval, else waiting. */
export const ownerWaitStage = (kind: Kind, state: string | undefined): Stage => (isApprovalWait(kind, state) ? "approval" : "waiting");

const Wants = z.looseObject({ status: z.string().optional(), question: z.string().optional(), plan: z.string().optional(), reason: RunReason.optional() });

/** The kind as it stood at an earlier machine version, kept by `rememberKinds`, so a saved item restores across a change. */
const earlierKinds = (state: State, kind: Kind) => (machineVersion: string) => state.kinds.get(`${kind.machine.id}@${machineVersion}`);

/** Saves every kind under its machine version. Call it whenever a config is loaded. */
export const rememberKinds = (state: State, config: Config): void => {
	for (const kind of Object.values(config.kinds)) state.kinds.put(`${kind.machine.id}@${kind.machine.version}`, kind);
};

/** Whether the kind's machine tags this state with `tag`. */
const hasTag = (kind: Kind, state: string | undefined, tag: string): boolean => (state !== undefined && kind.machine.states[state]?.tags?.includes(tag)) ?? false;

export const isWaitingOnOwner = (kind: Kind, state: string | undefined): boolean => hasTag(kind, state, OWNER_WAIT_TAG);

export const hasEndedStuck = (kind: Kind, state: string | undefined): boolean => hasTag(kind, state, STUCK_TAG);

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

const pass = async (o: ThinPathOptions): Promise<ThinResult> => {
	const base = o.base ?? DEFAULT_BASE;
	const id = o.itemId ?? (await o.workSource.listReady())[0]?.id;

	if (id === undefined) return { outcome: "idle" };

	// A parked item stays parked until the owner acts: its file still says ready, and a rerun would spend the same tokens again.
	const parked = o.state.parked.get(id);

	if (parked) return { outcome: parked.why, item: id, detail: parked.cause };

	// An item gets its kind before its first snapshot, so an item with no saved kind has nothing to restore.
	const known = o.state.itemKinds.get(id);
	const knownKind = known && kindNamed(o.config, known.kind);
	const saved = knownKind ? await o.state.items.restore(id, knownKind, { sources: stubSources(knownKind), kindAt: earlierKinds(o.state, knownKind) }) : ({ ok: true, value: undefined } as const);

	if (!saved.ok) return { outcome: "held", item: id, why: saved.fault.cause };

	const at = saved.value === undefined ? undefined : String(saved.value.getSnapshot().value);

	if (knownKind && hasEndedStuck(knownKind, at)) return park(o, { outcome: "stuck", item: id, detail: "the saved state ended stuck" });

	const claim = await o.workSource.claim(id, o.holder, claimTtlMs(o.config));

	if (!claim.won) return { outcome: "lost", item: id };

	const judge = o.judge ?? configuredModelCall(o.runner, o.config.hum, (item, tokens) => tallyOf(o.state, item).spend(tokens));
	const { now } = o;
	const onSnapshot = saved.value !== undefined;
	const ownerWait = knownKind && isWaitingOnOwner(knownKind, at) ? ownerWaitStage(knownKind, at) : undefined;
	const stage: Stage = o.state.landings.get(id) ? "approval" : (ownerWait ?? (onSnapshot ? "running" : "waiting"));
	const item = await settleAnswers({ state: o.state, workSource: o.workSource, judge, now }, await o.workSource.read(id), { stage });
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
	const kindName = settled ? settled.kind : await keepKind(kindContext, item, await pickKind(kindContext, item));
	const kind = kindNamed(o.config, kindName);
	const asking = isWaitingOnOwner(kind, at);
	const answered = asking || !onSnapshot ? answerTo(item) : undefined;

	if (asking && answered === undefined) return { outcome: "waiting", item: id };

	const landing = o.state.landings.get(id);
	/** Nothing saved is left to go on from: a new item, one that moved to another kind, or one the owner ran again. */
	const isFresh = !onSnapshot && landing === undefined;
	const branch = runBranch(o.config.hum, id);
	const timeoutMs = commandTimeoutMs(o.config.hum);
	const taken = await (o.checkout ?? clonesIn(o.workDir, timeoutMs))({ remote: o.remote, base, item: id, signal: o.signal }).catch((error: Error) => (o.signal?.aborted ? undefined : Promise.reject(error)));

	if (taken === undefined) return { outcome: "lost", item: id };

	const { folder: clone } = taken;
	const { commitIdentity } = o.config.hum;
	/** The agent's own commits take the owner's identity too: a fresh clone holds none of the repo's local git config. */
	const env = { ...identityEnv(commitIdentity), ...taken.env };
	const git = gitIn(clone, { identity: commitIdentity, timeoutMs });
	const g = (args: readonly string[]): Promise<string> => git.raw(args);

	try {
		await onRunBranch(git, { branch, restartAt: isFresh ? `origin/${base}` : undefined });

		const driven: Driven = { ...o, base, dir: o.dir ?? o.config.hum.itemsDir, kindName, kind, judge, id, item, branch, clone, env, g, git, answered, resume: asking, restarted: isFresh };

		// A change already finished lands again from its pushed branch; no run is spent on it.
		const result = park(o, landing ? await landAgain(driven) : await drive(driven));

		if (result.outcome === "moved") forgetProgress(o.state, id);

		return result;
	} finally {
		await taken.giveBack();
	}
};

/** Where a run's working copy comes from: the remote and the branch it starts on. */
export type Source = { readonly remote: string; readonly base: string };

/** What a checkout is asked for: a working copy of `source` for the item's pass, and the signal that ends the wait for one. */
type CheckoutRequest = Source & { readonly item: string; readonly signal: AbortSignal | undefined };

/** A run's working copy: its folder, the environment its runs and checks add, and the call that takes it back. */
export type Checkedout = {
	readonly folder: string;
	readonly env: Readonly<Record<string, string>>;
	readonly giveBack: () => Promise<void>;
};

/**
 * Gives an item's pass its working copy, with the base branch's files and `origin/<base>`, where a restarted run
 * branch starts. A background run starts only in a repo the owner trusts, which a fresh clone is not; a slot is a
 * worktree of the owner's checkout.
 */
export type Checkout = (request: CheckoutRequest) => Promise<Checkedout>;

/** A fresh `git clone` in a new folder under `workDir` (a temp folder by default), removed when the pass ends. */
const clonesIn =
	(workDir: string | undefined, timeoutMs: number): Checkout =>
	async ({ remote, base }) => {
		const folder = mkdtempSync(join(workDir ?? tmpdir(), "hum-run-"));

		await gitIn(tmpdir(), { timeoutMs }).raw(["clone", "-q", "--branch", base, remote, folder]);

		return { folder, env: {}, giveBack: async () => rmSync(folder, { recursive: true, force: true }) };
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
	readonly env: Readonly<Record<string, string>>;
	readonly g: (args: readonly string[]) => Promise<string>;
	readonly git: Git;
	readonly answered: Answered | undefined;
	/** Restore the saved owner-wait snapshot instead of starting the machine. */
	readonly resume: boolean;
	/** The run branch starts again at the base: earlier work on the item, and the plan written for it, are gone. */
	readonly restarted: boolean;
};

const drive = async (d: Driven): Promise<ThinResult> => {
	const { state, runner, config, kind, id, item, branch, clone, g, base } = d;
	const maxFixes = config.hum.maxFixRuns;
	const result = Promise.withResolvers<ThinResult>();

	// The worker lost the claim or is exiting for an update: the run stops, and its actor with it.
	d.signal?.addEventListener("abort", () => result.resolve({ outcome: "lost", item: id }), { once: true });
	// The total over all runs is saved; the cap counts what the item spent since the owner last answered.
	const tally = tallyOf(state, id);

	if (d.answered) tally.startAfresh();

	let fixes = 0;
	let lastFailure = "";
	let cause = "";
	let handled = "";
	let pending: Pending | undefined;
	let approvedByOwner = false;
	let actor: AnyActor;

	const stuckCause = (): string | undefined => cause || lastFailure.slice(0, CARD_EXCERPT) || undefined;

	const failed = (message: string): Error => {
		cause = message;

		return new Error(message);
	};

	/** A plan or build is placed by the files its item declares; a fix or review by the branch's diff so far. */
	const tierFor = async (purpose: Purpose) => {
		const declared = { paths: footprintOf(item) ?? [], size: 0, loosened: false, pinChanged: false };
		const change = PLACED_BY_DIFF[purpose] ? await changeOn(landContext(d)) : declared;
		const { placement } = await placementOf(landContext(d), change);
		const row = pickTier(kind, { purpose, level: placement.level.name, size: "small" });

		if (!row) throw new Error(`the ${d.kindName} table has no ${purpose} row`);

		return { model: config.hum.models[row.tier], effort: row.effort };
	};


	const branchDiff = (): Promise<string> => g(["diff", ...PATCH, `origin/${base}...HEAD`]);

	const prompt = async (purpose: "build" | "fix"): Promise<string> => {
		const plan = state.plans.get(id);

		const parts = [
			roleOf(config, purpose),
			`# Item ${id}: ${item.title}\n\n${item.body}`,
			`Work on the branch ${branch}. Commit the change when it is whole. End with the JSON {"status":"done"}, or {"status":"needs-owner","question":…,"plan":…} when only the owner can answer.`,
		];

		if (plan) parts.push(`## The approved plan (${plan.hash})\n${JSON.stringify(plan.plan, null, 2)}`);

		if (d.answered) {
			const soFar = d.restarted
				? `## The branch so far\nIt starts again at origin/${base}: the earlier work on this item was discarded, and no file it made is here.`
				: `## The plan so far\n${d.answered.plan || "(none saved)"}\n\n## The branch so far\n${(await branchDiff()).slice(0, config.hum.diffLimit)}`;

			parts.push(`## The owner answered\nQuestion: ${d.answered.question}\nAnswer: ${d.answered.answer}\n\n${soFar}`);
		}

		if (purpose === "fix") parts.push(`## What to fix\n${lastFailure.slice(-config.hum.failureTail)}\nFix the cause and commit.`);

		return parts.join("\n\n");
	};



	/** Never settles: the driver stops the actor, so the saved snapshot stays at the state it was in. */
	const pause = (outcome: ThinResult): Promise<never> => {
		result.resolve(outcome);

		return new Promise<never>(() => {});
	};

	/** The kinds reach their owner-wait state only through the over-cap event, so a run's question uses it too. */
	const ask = (note: Pending) => {
		pending = note;
		actor.send({ type: "token-cap" });
	};

	/** One agent run of the item. A limit, a hold or a stop pauses the item; passing the token cap asks the owner where the state can, and ends stuck where it cannot. */
	const runAgent = async (purpose: Purpose, text: string, schema: JsonSchema, signal: AbortSignal): Promise<Finished> => {
		const attempt = state.runs.unended(id, purpose)?.attempt ?? state.runs.list(id).length;
		const key = { itemId: id, run: purpose, attempt };
		const begun = state.runs.begin(key, { name: `hum ${id} ${purpose} #${attempt}`, sessionId: d.newSessionId() });
		const held = purpose === "build" || purpose === "fix" ? readMemory(join(clone, ".hum", "memory.md"), config.hum.memoryMaxBytes).entries : [];
		const prefix = config.hum.roles[purpose]?.file ?? purpose;

		const lease = await d.gate?.enter(prefix, signal);

		const outcome = await runner
			.run({
				prompt: `${text}${memorySection(held)}`,
				cwd: purpose === "review" ? tmpdir() : clone,
				env: d.env,
				...(await tierFor(purpose)),
				schema,
				tokenCap: kind.tokenCap.tokens - tally.sinceAnswer(),
				name: begun.record.name,
				// A saved id already has a transcript under it; a fresh run mints its own.
				sessionId: begun.adopted ? undefined : begun.record.sessionId,
				signal,
				onSession: (sessionId) => begun.saveSession(sessionId),
				onFirstToken: () => lease?.opened(),
			})
			.finally(() => lease?.release());

		begun.end(held.length === 0 ? undefined : outcome.kind === "finished" ? rulesUsed(outcome, held) : []);

		if (isPaused(outcome)) return pause(pauseOf(id, outcome));

		if (outcome.kind === "over-cap") {
			tally.spend(outcome.tokens);

			const why = `The run passed its token cap (${kind.tokenCap.tokens}) at ${tally.sinceAnswer()} tokens.`;

			if (!actor.getSnapshot().can({ type: "token-cap" })) throw failed(why);

			ask({ question: { text: PLAIN_QUESTIONS["over-cap"], detail: why }, plain: "over-cap", plan: "" });

			return new Promise<never>(() => {});
		}

		tally.spend(outcome.tokens);

		return outcome;
	};

	/** The owner is asked, or the run's choice stands and is listed under the choices made without them. */
	const settleNeed = async (wants: z.infer<typeof Wants>): Promise<{ asked: Pending } | { chose: string }> => {
		const reason = wants.reason ?? { kind: "unsure" as const };
		const change = await changeOn(landContext(d));
		const { placement } = await placementOf(landContext(d), change);

		const decision = askDecision(reason, {
			runnerVariables: d.runnerVariables,
			changedPaths: change.paths,
			level: placement.level.name,
			undoableLevels: config.hum.undoableLevels,
		});

		if (decision.action === "ask") return { asked: { ...askedQuestion({ reason, confirmed: decision.confirmed, runsWords: wants.question }), plan: wants.plan ?? "" } };

		const text = `Chose "${decision.choice}" over ${decision.over.filter((word) => word !== decision.choice).join(", ")} without you.`;
		const calls = onceCalls({ apiVersion: ADAPTER_API_VERSION, workSource: d.workSource, questions: d.questions }, state.ops, { run: "decide", attempt: state.runs.list(id).length });

		await calls.questions?.decide(id, text);
		state.choices.put(`${id}@${text}`, { item: id, text, at: d.now() });

		return { chose: text };
	};

	const step = (purpose: "build" | "fix") =>
		createAsyncLogic({
			run: async ({ signal }) => {
				if (purpose === "fix" && ++fixes > maxFixes) throw failed(`the checks still fail after ${maxFixes} fixes`);

				const before = (await g(["rev-parse", "HEAD"])).trim();
				const chosen: string[] = [];

				for (;;) {
					const outcome = await runAgent(purpose, `${await prompt(purpose)}${chosenSection(chosen)}`, RUN_SCHEMA, signal);

					if (!hasSucceeded(outcome)) throw failed(`the ${purpose} run ended as ${outcome.subtype}: ${outcome.text.slice(0, CARD_EXCERPT)}`);

					const wants = Wants.safeParse(outcome.structured).data;

					if (wants?.status !== "needs-owner") break;

					const settled = await settleNeed(wants);

					if ("asked" in settled) return ask(settled.asked);

					chosen.push(settled.chose);
				}

				// Done is a new commit on the branch, not the run's word.
				if ((await g(["rev-parse", "HEAD"])).trim() === before) throw failed(`the ${purpose} run succeeded and committed nothing`);
			},
		});

	const checksSource = createAsyncLogic({
		run: async () => {
			const failure = await runChecks(d.checks, clone, { env: d.env, timeoutMs: checksTimeoutMs(d.config.hum) });

			if (failure) {
				lastFailure = failure;
				throw new Error(failure.slice(0, ERROR_EXCERPT));
			}
		},
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
			"request-changes",
			(pick) => {
				lastFailure = requestedChanges(pick);
			},
		],
	]);

	const saveVerdict = (pick: EventPick, models: readonly string[], head: string) => state.verdicts.put(id, verdictOf({ id, head, pick, models }));

	/** A plan or review state: its run picks the next event, and a split files the parts and lands the item as done. */
	const decision = (purpose: ProsePurpose) =>
		createAsyncLogic({
			run: async ({ signal }) => {
				const diff = purpose === "review" ? await branchDiff() : "";
				const head = (await g(["rev-parse", "HEAD"])).trim();

				const { pick, models } = await decideProse({
					purpose,
					prompt: PROSE_PROMPTS[purpose](config, item, diff),
					diff,
					model: (await tierFor(purpose)).model,
					run: (text, schema) => runAgent(purpose, text, schema, signal),
					canTake: (type) => actor.getSnapshot().can({ type }),
				});

				if (purpose === "review") saveVerdict(pick, models, head);

				PICKED.get(pick.event)?.(pick, models);

				if (pick.event === SPLIT) return result.resolve(await split(d, pick.parts, () => actor.send({ type: SPLIT })));

				actor.send({ type: pick.event });
			},
		});

	const sources = { build: step("build"), checks: checksSource, fix: step("fix"), plan: decision("plan"), review: decision("review") };

	if (d.resume) {
		const restored = await state.items.restore(id, kind, { sources, kindAt: earlierKinds(state, kind) });

		if (!restored.ok) return { outcome: "held", item: id, why: restored.fault.cause };

		if (!restored.value) return { outcome: "held", item: id, why: `the saved state of ${id} vanished` };

		actor = restored.value;
		// The wait it was saved in is already handled; only what follows the answer needs a reaction.
		handled = String(actor.getSnapshot().value);
	} else {
		actor = createActor(kindMachine(kind, sources));
	}

	const react = async (value: string) => {
		if (handled === value) return;

		handled = value;

		if (hasEndedStuck(kind, value)) return result.resolve({ outcome: "stuck", item: id, detail: stuckCause() });

		if (isWaitingOnOwner(kind, value)) {
			const note = pending ?? { question: { text: "The run stopped for the owner." }, plain: "unsure" as const, plan: "" };

			if (!(await isStillMine(d))) return result.resolve({ outcome: "lost", item: id });

			const stopped = await handOff(d, isApprovalWait(kind, value) ? approvalQuestion(note) : note);

			return result.resolve(stopped ?? { outcome: "asked", item: id, detail: note.question.text });
		}

		if (value === "merging") return result.resolve(await merge(d, { onMerged: () => actor.send({ type: "merged" }), ownerApproved: approvedByOwner }));
	};

	actor.subscribe((snapshot) => {
		const saved = state.items.save(id, kind, persistedSnapshot(actor));

		if (!saved.ok) result.reject(new Error(saved.fault.cause));

		if (snapshot.status === "done") {
			state.items.remove(id);

			return result.resolve({ outcome: "merged", item: id });
		}

		react(String(snapshot.value)).catch((error) => result.reject(error));
	});

	actor.start();

	if (d.answered && d.resume) {
		const resume = resumeEvent(actor.getSnapshot(), d.answered);

		approvedByOwner = resume === OWNER_APPROVED;

		if (resume === OWNER_REJECTED) lastFailure = d.answered.answer;

		actor.send({ type: resume });
	}

	return result.promise.finally(() => actor.stop());
};

/** What a run left for the owner: the question, the plain one it falls back to, and the plan so far. */
type Pending = { readonly question: Question; readonly plain: PlainQuestion; readonly plan: string };

const chosenSection = (chosen: readonly string[]): string => (chosen.length === 0 ? "" : `\n\n## Decided without the owner\n${chosen.map((text) => `- ${text}`).join("\n")}\nGo on with these choices.`);

const OWNER_APPROVED = "owner-approved";

const OWNER_REJECTED = "owner-rejected";

const ANSWERED = "answered";

/** The event an owner's answer sends a saved wait: `answered` where the state takes it, else the owner's approval or rejection of the change. */
const resumeEvent = (snapshot: { can: (event: { type: string }) => boolean }, answered: Answered) => {
	if (snapshot.can({ type: ANSWERED })) return ANSWERED;

	return answered.option === OWNER_APPROVAL ? OWNER_APPROVED : OWNER_REJECTED;
};

type Purpose = (typeof PURPOSES)[number];

/** Which runs are placed by the branch's diff so far; the others by the files their item declares. */
const PLACED_BY_DIFF = { plan: false, build: false, fix: true, review: true } as const satisfies Record<Purpose, boolean>;

/** The event by which a plan run splits its item into parts. */
const SPLIT = "needs-split";

/** What a run reads from its config: the settings and the role files. */
export type RunConfig = Pick<Config, "hum" | "roles">;

const roleOf = (config: RunConfig, purpose: Purpose): string => {
	const role = config.hum.roles[purpose];

	return ((role && config.roles[role.file]) ?? "").trim();
};


/** What a plan or review run reads. A plan run reads the repo too; a review run reads only the item and the diff, so no author's reasoning reaches it. */
export const PROSE_PROMPTS = {
	plan: (config: RunConfig, item: ItemText): string =>
		[
			roleOf(config, "plan"),
			`# Item ${item.id}: ${item.title}\n\n${item.body}`,
			"Plan the change: read the repo, edit nothing. A plan-ready answer holds the plan; a needs-split answer names each part as a title; a plan-blocked answer asks the owner one question.",
		].join("\n\n"),
	review: (config: RunConfig, item: ItemText, diff: string): string => [roleOf(config, "review"), reviewInput(item, diff, config.hum)].join("\n\n"),
} as const satisfies Record<ProsePurpose, (config: RunConfig, item: ItemText, diff: string) => string>;

const verdictOf = ({ id, head, pick, models }: { readonly id: string; readonly head: string; readonly pick: EventPick; readonly models: readonly string[] }) => ({ item: id, head, event: pick.event, reason: pick.reason, cites: pick.cites, models: [...models] });

/** A run that ended with no answer and no token to count: a usage limit, a hold, or a stop. */
type Paused = Extract<RunOutcome, { kind: "limited" | "held" | "stopped" }>;

const PAUSED_KINDS: readonly string[] = ["limited", "held", "stopped"] satisfies readonly Paused["kind"][];

const isPaused = (outcome: RunOutcome): outcome is Paused => PAUSED_KINDS.includes(outcome.kind);

/** What a paused run comes to for its item. */
const pauseOf = (id: string, outcome: Paused): ThinResult => {
	switch (outcome.kind) {
		case "limited":
			return { outcome: "limited", item: id, until: outcome.until };
		case "held":
			return { outcome: "held", item: id, why: outcome.card.cause };
		case "stopped":
			return { outcome: "lost", item: id };
	}
};

/** A fresh review run at landing, for a level that asks for one: it reads only the item and the diff, and its verdict is saved. */
const reviewAtLanding =
	(d: Driven) =>
	async ({ head, diff, level }: { head: string; diff: string; level: string }): Promise<ReviewOutcome> => {
		const row = pickTier(d.kind, { purpose: "review", level, size: "small" });

		if (!row) throw new Error(`the ${d.kindName} table has no review row`);

		const tally = tallyOf(d.state, d.id);

		let halt: (result: ThinResult) => void = () => {};

		const halted = new Promise<ReviewOutcome>((resolve) => {
			halt = (result) => resolve({ halted: result });
		});

		/** A run with no answer never settles, as AnswerRun requires; the review comes to `halted` instead. */
		const run = async (prompt: string, schema: JsonSchema): Promise<Finished> => {
			const outcome = await d.runner.run({ prompt, cwd: tmpdir(), model: d.config.hum.models[row.tier], effort: row.effort, schema, signal: d.signal, tokenCap: d.kind.tokenCap.tokens - tally.sinceAnswer() });

			if (outcome.kind === "finished") {
				tally.spend(outcome.tokens);

				return outcome;
			}

			if (outcome.kind === "over-cap") tally.spend(outcome.tokens);

			halt(isPaused(outcome) ? pauseOf(d.id, outcome) : { outcome: "review", item: d.id, detail: `the review run passed the item's token cap (${d.kind.tokenCap.tokens}) at ${tally.sinceAnswer()} tokens` });

			return new Promise<never>(() => {});
		};

		const decided = decideProse({ purpose: "review", prompt: PROSE_PROMPTS.review(d.config, d.item, diff), diff, model: d.config.hum.models[row.tier], run }).then(({ pick, models }): ReviewOutcome => {
			const verdict = verdictOf({ id: d.id, head, pick, models });

			d.state.verdicts.put(d.id, verdict);

			return { verdict };
		});

		return Promise.race([decided, halted]);
	};

/** Files each part of a split item as its own item, then lands the item as done with no change of its own. */
const split = async (d: Driven, parts: readonly string[], onMerged: () => void): Promise<ThinResult> => {
	const calls = onceCalls({ apiVersion: ADAPTER_API_VERSION, workSource: d.workSource, questions: d.questions }, d.state.ops, { run: SPLIT, attempt: 0 });

	for (const title of parts) await calls.workSource?.fileFollowUp(d.id, { title, body: `Split from ${d.id}: ${d.item.title}` });

	return merge(d, { onMerged });
};

/** The owner-review wait asks for the change's approval, whatever the review run wrote. */
const approvalQuestion = ({ question, plan }: Pending): Pending => ({
	question: { text: PLAIN_QUESTIONS["owner-review"], detail: question.detail ?? question.text },
	plain: "owner-review",
	plan,
});

/** Push the work branch, put the plan on the item, queue the question for room under the daily cap, and end. Each write runs once per key. A push that did not land ends the pass with its result instead. */
const handOff = async (d: Driven, { question, plain, plan }: Pending): Promise<ThinResult | undefined> => {
	const { state, id, g, branch, workSource, questions, git } = d;
	const attempt = state.runs.list(id).length;
	const key = (op: string) => ({ itemId: id, run: "ask", attempt, op });
	const calls = onceCalls({ apiVersion: ADAPTER_API_VERSION, workSource, questions }, state.ops, { run: "ask", attempt });

	const pushed = await state.ops.once(key("push-branch"), {
		holds: async () => (await g(["ls-remote", "--heads", "origin", branch])).startsWith((await g(["rev-parse", "HEAD"])).trim()),
		run: () => push(git, ["--force", "origin", `HEAD:refs/heads/${branch}`]),
		isDone: ({ kind }) => kind === "pushed",
	});

	if (pushed.kind === "ran" && pushed.value.kind !== "pushed") return unpushed(id, branch, pushed.value);

	if (plan.trim()) await calls.workSource?.comment(id, `${PLAN_MARK}\n${plan.trim()}`);

	queueQuestion(d, d.item, question, plain);
	await releaseQuestions(d);

	return undefined;
};

/** Every act that changes the world checks the claim first. */
const isStillMine = async (d: Pick<Driven, "workSource" | "id" | "holder" | "config">): Promise<boolean> => (await d.workSource.renew(d.id, d.holder, claimTtlMs(d.config))).won;

const landContext = (d: Driven): LandContext => ({
	state: d.state,
	config: d.config,
	kind: d.kindName,
	id: d.id,
	item: d.item,
	branch: d.branch,
	base: d.base,
	remote: d.remote,
	clone: d.clone,
	env: d.env,
	dir: d.dir,
	git: d.git,
	checks: d.checks,
	workSource: d.workSource,
	questions: d.questions,
	pulls: d.pulls,
	now: d.now,
	judge: d.judge,
	reviewRun: reviewAtLanding(d),
});

const DRAINING = "the worker restarts for an update; the next worker lands the change under its config";

/**
 * At `merging`: the change is saved and its branch pushed, then landed by its level unless the worker drains. A
 * docs-only item whose change reaches past its globs moves to its real kind first.
 */
const merge = async (d: Driven, { onMerged, ownerApproved = false }: { readonly onMerged: () => void; readonly ownerApproved?: boolean }): Promise<ThinResult> => {
	if (!(await isStillMine(d))) return { outcome: "lost", item: d.id };

	if (d.kindName === d.config.hum.checkKind) {
		const proof = await proveCheckItem({ state: d.state, config: d.config, git: d.git, item: d.id, base: d.base, checks: d.checks, now: d.now });

		if (proof && !proof.passed) return { outcome: "stuck", item: d.id, detail: proof.reason };
	}

	const isDocsOnly = d.kindName === d.config.hum.docsOnly.kind;

	if (isDocsOnly && doesLeaveDocs((await changeOn(landContext(d))).paths, d.config.hum)) {
		const real = await keepKind(d, d.item, await pickKind(d, d.item, d.kindName), d.kindName);

		return { outcome: "moved", item: d.id, kind: real };
	}

	const pushed = await prepareLanding(landContext(d), { ownerApproved });

	if (pushed.kind !== "pushed") return unpushed(d.id, d.branch, pushed);

	if (d.mayLand?.() === false) return { outcome: "held", item: d.id, why: DRAINING };

	const result = await land(landContext(d));

	if (result.outcome === "merged") onMerged();

	return result;
};

/** A finished change whose landing did not end: its pushed branch lands again, and once merged its saved state goes. */
const landAgain = async (d: Driven): Promise<ThinResult> => {
	if (d.mayLand?.() === false) return { outcome: "held", item: d.id, why: DRAINING };

	const result = await land(landContext(d));

	if (result.outcome === "merged") d.state.items.remove(d.id);

	return result;
};

/** The answer option that runs a parked item again from the start. */
export const RUN_AGAIN = "retry";

type Parking = { readonly outcome: "stuck" | "review"; readonly item: string; readonly detail?: string };

const isParking = (result: ThinResult): result is ThinResult & Parking => result.outcome === "stuck" || result.outcome === "review";

const PARKING = {
	stuck: {
		code: "item-stuck",
		fallback: "a run failed",
		cause: (item: string, why: string) => `${item} ended stuck: ${why}`,
		fix: "Fix the cause, then run it again.",
		action: { label: "Run it again", answer: RUN_AGAIN },
	},
	review: {
		code: "item-review",
		fallback: "its change waits for a review",
		cause: (item: string, why: string) => `${item} is ready to merge but needs your review: ${why}`,
		fix: "Review the branch, then approve it on the item, or answer retry to run it again.",
		action: { label: "Approve", answer: OWNER_APPROVAL },
	},
} as const satisfies Record<Parking["outcome"], { code: string; fallback: string; cause: (item: string, why: string) => string; fix: string; action: { label: string; answer: string } }>;

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
