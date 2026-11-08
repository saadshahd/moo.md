import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { type AnyActor, createActor, createAsyncLogic } from "xstate";
import type { Item, Questions, WorkSource } from "../adapter-api.ts";
import { type Runner, succeeded } from "../adapters/claude-p.ts";
import { ADAPTER_API_VERSION } from "../adapter-api.ts";
import { onceCalls } from "../adapters/once.ts";
import { type Git, gitIn, PATCH, push } from "../adapters/git.ts";
import type { PullRequests } from "../adapters/pull-requests.ts";
import { pickTier } from "../config/checks.ts";
import type { Config } from "../config/load.ts";
import { kindMachine } from "../config/machine.ts";
import { type Kind, type Naming, OWNER_WAIT_TAG, STUCK_TAG } from "../config/schema.ts";
import { persistedSnapshot } from "../state/items.ts";
import type { State } from "../state/open.ts";
import { SECOND_MS } from "../time.ts";
import { runChecks } from "./checks.ts";
import { changeOn, type LandContext, land, placementOf, prepareLanding } from "./land.ts";
import { OWNER_APPROVAL } from "../decide/merge.ts";
import { DIFF_LIMIT } from "../decide/review.ts";
import { footprintOf, type PrefixGate } from "./scheduler.ts";

/** How long a claim lasts unless its holder renews it. */
export const claimTtlMs = (config: Config): number => config.hum.claimExpirySeconds * SECOND_MS;

const FAILURE_TAIL = 4000;

const CARD_EXCERPT = 300;

const ERROR_EXCERPT = 500;

export const runBranch = ({ runBranchPrefix }: Naming, id: string): string => `${runBranchPrefix}${id}`;

/** What the agent run hands back besides its commit. */
export const RUN_SCHEMA = {
	type: "object",
	properties: { status: { enum: ["done", "needs-owner"] }, question: { type: "string" }, plan: { type: "string" } },
	required: ["status"],
} as const;

/** The comment that carries a run's plan on the item's thread, so the next run reads it. */
export const PLAN_MARK = "hum plan:";

export type ThinPathOptions = {
	readonly workSource: WorkSource;
	readonly questions: Questions;
	readonly state: State;
	readonly runner: Runner;
	readonly config: Config;
	readonly kind: string;
	/** The work repo's remote: a URL or path. Runs clone it; nothing touches the owner's checkout. */
	readonly remote: string;
	readonly base?: string;
	/** The repo's checks as shell commands, run in the clone. All must exit 0. */
	readonly checks: readonly string[];
	readonly holder: string;
	/** Where runs clone to; a temp folder by default. */
	readonly workDir?: string;
	readonly dir?: string;
	/** Take this item; default the first ready one. */
	readonly itemId?: string;
	readonly now?: () => number;
	/** Aborted when the worker loses the claim or exits for an update; the run stops and the result is `lost`. */
	readonly signal?: AbortSignal;
	/** Lets the first run of a shared prompt prefix reach its first token before the rest start. */
	readonly gate?: PrefixGate;
	/** The remote's pull requests and branch rules, for a remote on GitHub. */
	readonly pulls?: PullRequests;
	/** False while the worker drains for an update: a finished change is saved and pushed, and the next worker lands it under the config it starts with. */
	readonly mayLand?: () => boolean;
};

export type ThinResult =
	| { readonly outcome: "idle" }
	| { readonly outcome: "lost" | "waiting"; readonly item: string }
	| { readonly outcome: "merged" | "asked" | "stuck" | "review" | "landing"; readonly item: string; readonly detail?: string }
	| { readonly outcome: "limited"; readonly item: string; readonly until: number }
	| { readonly outcome: "held"; readonly item: string; readonly why: string };

type Answered = { readonly question: string; readonly answer: string; readonly plan: string };

/** The question, the answer to it and the plan, once the owner has answered the latest question. */
export const answerTo = (item: Item): Answered | undefined => {
	const lastQuestion = item.thread.findLastIndex((e) => e.kind === "question");
	const answer = item.thread.slice(lastQuestion + 1).find((e) => e.kind === "answer");

	if (lastQuestion < 0 || !answer) return undefined;

	const plan = item.thread.findLast((e) => e.kind === "comment" && e.text.startsWith(PLAN_MARK));

	return {
		question: item.thread[lastQuestion]?.text ?? "",
		answer: answer.option ? `${answer.option}: ${answer.text}` : answer.text,
		plan: plan?.text.slice(PLAN_MARK.length).trim() ?? "",
	};
};

const Wants = z.looseObject({ status: z.string().optional(), question: z.string().optional(), plan: z.string().optional() });

/** The kind as it stood at an earlier machine version, kept by `rememberKinds`, so a saved item restores across a change. */
const earlierKinds = (state: State, kind: Kind) => (machineVersion: string) => state.kinds.get(`${kind.machine.id}@${machineVersion}`);

/** Saves every kind under its machine version. Call it whenever a config is loaded. */
export const rememberKinds = (state: State, config: Config): void => {
	for (const kind of Object.values(config.kinds)) state.kinds.put(`${kind.machine.id}@${kind.machine.version}`, kind);
};

/** Whether the kind's machine tags this state with `tag`. */
const hasTag = (kind: Kind, state: string | undefined, tag: string): boolean => (state !== undefined && kind.machine.states[state]?.tags?.includes(tag)) ?? false;

export const waitsOnOwner = (kind: Kind, state: string | undefined): boolean => hasTag(kind, state, OWNER_WAIT_TAG);

export const endedStuck = (kind: Kind, state: string | undefined): boolean => hasTag(kind, state, STUCK_TAG);

/** Placeholder sources: enough to restore a snapshot and read its state before the real sources exist. */
const stubSources = (kind: Kind) => {
	const idle = createAsyncLogic({ run: async () => {} });

	return Object.fromEntries(Object.values(kind.machine.states).flatMap((node) => (node.invoke ? [[node.invoke.src, idle]] : [])));
};

/**
 * The thin path: a ready markdown item is claimed, built by a `claude -p` run on its run branch,
 * checked by the repo's own checks, and merged in one push that also sets the item's state to done, when its
 * paths are all at the lowest level. A run that needs the owner pushes its branch, asks on the item and
 * ends; the answer starts a fresh run on that branch. Never `--resume`.
 */
export const runThinPath = async (o: ThinPathOptions): Promise<ThinResult> => {
	const base = o.base ?? "main";
	const kind = o.config.kinds[o.kind];

	if (!kind) throw new Error(`no kind "${o.kind}" in the config`);

	const id = o.itemId ?? (await o.workSource.listReady())[0]?.id;

	if (id === undefined) return { outcome: "idle" };

	const saved = await o.state.items.restore(id, kind, { sources: stubSources(kind), kindAt: earlierKinds(o.state, kind) });

	if (!saved.ok) return { outcome: "held", item: id, why: saved.fault.cause };

	const at = saved.value === undefined ? undefined : String(saved.value.getSnapshot().value);

	// A parked item stays parked until the owner acts: its file still says ready, and a rerun would spend the same tokens again.
	const parked = o.state.parked.get(id);

	if (parked) return { outcome: parked.why, item: id, detail: parked.cause };

	if (endedStuck(kind, at)) return park(o, { outcome: "stuck", item: id, detail: "the saved state ended stuck" });

	const asking = waitsOnOwner(kind, at);
	const claim = await o.workSource.claim(id, o.holder, claimTtlMs(o.config));

	if (!claim.won) return { outcome: "lost", item: id };

	const item = await o.workSource.read(id);
	const answered = asking ? answerTo(item) : undefined;

	const awaitsAnswer = asking && answered === undefined;

	if (awaitsAnswer) return { outcome: "waiting", item: id };

	const landing = o.state.landings.get(id);
	const clone = mkdtempSync(join(o.workDir ?? tmpdir(), "hum-run-"));
	const branch = runBranch(o.config.hum, id);

	const git = gitIn(clone, { identity: o.config.hum.commitIdentity });
	const g = (args: readonly string[]): Promise<string> => git.raw(args);

	try {
		await gitIn(tmpdir()).raw(["clone", "-q", "--branch", base, o.remote, clone]);

		if ((await g(["ls-remote", "--heads", "origin", branch])).trim()) {
			await g(["fetch", "-q", "origin", `${branch}:${branch}`]);
			await g(["checkout", "-q", branch]);
		} else {
			await g(["checkout", "-q", "-b", branch]);
		}

		const driven: Driven = { ...o, base, dir: o.dir ?? o.config.hum.itemsDir, kindName: o.kind, kind, id, item, branch, clone, g, git, answered, resume: asking };

		// A change already finished lands again from its pushed branch; no run is spent on it.
		return park(o, landing ? await landAgain(driven) : await drive(driven));
	} finally {
		rmSync(clone, { recursive: true, force: true });
	}
};

type Driven = Omit<ThinPathOptions, "kind"> & {
	readonly kindName: string;
	readonly base: string;
	readonly dir: string;
	readonly kind: Kind;
	readonly id: string;
	readonly item: Item;
	readonly branch: string;
	readonly clone: string;
	readonly g: (args: readonly string[]) => Promise<string>;
	readonly git: Git;
	readonly answered: Answered | undefined;
	/** Restore the saved owner-wait snapshot instead of starting the machine. */
	readonly resume: boolean;
};

const drive = async (d: Driven): Promise<ThinResult> => {
	const { state, runner, config, kind, id, item, branch, clone, g, base } = d;
	const maxFixes = config.hum.maxFixRuns;
	const result = Promise.withResolvers<ThinResult>();

	// The worker lost the claim or is exiting for an update: the run stops, and its actor with it.
	d.signal?.addEventListener("abort", () => result.resolve({ outcome: "lost", item: id }), { once: true });
	// The total over all runs is saved; the cap counts what the item spent since the owner last answered.
	const tally = state.spent.get(id) ?? { item: id, total: 0, base: 0 };

	if (d.answered) tally.base = tally.total;

	const spend = (tokens: number) => {
		tally.total += tokens;
		state.spent.put(id, tally);
	};

	let fixes = 0;
	let lastFailure = "";
	let cause = "";
	let handled = "";
	let pending: { question: string; plan: string } | undefined;
	let actor: AnyActor;

	const stuckCause = (): string | undefined => cause || lastFailure.slice(0, CARD_EXCERPT) || undefined;

	const failed = (message: string): Error => {
		cause = message;

		return new Error(message);
	};

	/** A build is placed by the files its item declares; a fix by the branch's diff so far. */
	const tierFor = async (purpose: "build" | "fix") => {
		const declared = { paths: footprintOf(item) ?? [], size: 0, loosened: false, pinChanged: false };
		const change = purpose === "fix" ? await changeOn(landContext(d)) : declared;
		const { placement } = await placementOf(landContext(d), change);
		const row = pickTier(kind, { purpose, level: placement.level.name, size: "small" });

		if (!row) throw new Error(`the ${d.kindName} table has no ${purpose} row`);

		return { model: config.hum.models[row.tier], effort: row.effort };
	};

	const prompt = async (purpose: "build" | "fix"): Promise<string> => {
		const role = config.hum.roles[purpose];

		const parts = [
			((role && config.roles[role.file]) ?? "").trim(),
			`# Item ${id}: ${item.title}\n\n${item.body}`,
			`Work on the branch ${branch}. Commit the change when it is whole. End with the JSON {"status":"done"}, or {"status":"needs-owner","question":…,"plan":…} when only the owner can answer.`,
		];

		if (d.answered) {
			const diff = await g(["diff", ...PATCH, `origin/${base}...${branch}`]);

			parts.push(
				`## The owner answered\nQuestion: ${d.answered.question}\nAnswer: ${d.answered.answer}\n\n## The plan so far\n${d.answered.plan || "(none saved)"}\n\n## The branch so far\n${diff.slice(0, DIFF_LIMIT)}`,
			);
		}

		if (purpose === "fix") parts.push(`## The checks failed\n${lastFailure.slice(-FAILURE_TAIL)}\nFix the cause and commit.`);

		return parts.join("\n\n");
	};

	/** Never settles: the driver stops the actor, so the saved snapshot stays at the state it was in. */
	const pause = (outcome: ThinResult): Promise<never> => {
		result.resolve(outcome);

		return new Promise<never>(() => {});
	};

	/** The kinds reach their owner-wait state only through the over-cap event, so a run's question uses it too. */
	const ask = (question: string, plan: string) => {
		pending = { question, plan };
		actor.send({ type: "token-cap" });
	};

	const step = (purpose: "build" | "fix") =>
		createAsyncLogic({
			run: async ({ signal }) => {
				if (purpose === "fix" && ++fixes > maxFixes) throw failed(`the checks still fail after ${maxFixes} fixes`);

				const attempt = state.runs.list(id).length;
				const key = { itemId: id, run: purpose, attempt };
				const begun = state.runs.begin(key, `hum ${id} ${purpose} #${attempt}`, crypto.randomUUID());
				const before = (await g(["rev-parse", "HEAD"])).trim();
				const prefix = config.hum.roles[purpose]?.file ?? purpose;

				const lease = await d.gate?.enter(prefix, signal);

				const outcome = await runner
					.run({
						prompt: await prompt(purpose),
						cwd: clone,
						...(await tierFor(purpose)),
						schema: RUN_SCHEMA,
						tokenCap: kind.tokenCap.tokens - (tally.total - tally.base),
						sessionId: begun.record.sessionId,
						signal,
						onSession: (sessionId) => state.runs.saveSession(key, sessionId),
						onFirstToken: () => lease?.opened(),
					})
					.finally(() => lease?.release());

				if (outcome.kind === "limited") return pause({ outcome: "limited", item: id, until: outcome.until });

				if (outcome.kind === "held") return pause({ outcome: "held", item: id, why: outcome.card.cause });

				if (outcome.kind === "over-cap") {
					spend(outcome.tokens);

					return ask(`The run passed its token cap (${kind.tokenCap.tokens}) at ${tally.total - tally.base} tokens.`, "");
				}

				spend(outcome.tokens);

				if (!succeeded(outcome)) throw failed(`the ${purpose} run ended as ${outcome.subtype}: ${outcome.text.slice(0, CARD_EXCERPT)}`);

				const wants = Wants.safeParse(outcome.structured).data;

				if (wants?.status === "needs-owner") return ask(wants.question ?? "The run needs an answer only you hold.", wants.plan ?? "");

				// Done is a new commit on the branch, not the run's word.
				if ((await g(["rev-parse", "HEAD"])).trim() === before) throw failed(`the ${purpose} run succeeded and committed nothing`);
			},
		});

	const checksSource = createAsyncLogic({
		run: async () => {
			const failure = await runChecks(d.checks, clone);

			if (failure) {
				lastFailure = failure;
				throw new Error(failure.slice(0, ERROR_EXCERPT));
			}
		},
	});

	const sources = { build: step("build"), checks: checksSource, fix: step("fix") };

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

		if (endedStuck(kind, value)) return result.resolve({ outcome: "stuck", item: id, detail: stuckCause() });

		if (waitsOnOwner(kind, value)) {
			const note = pending ?? { question: "The run stopped for the owner.", plan: "" };

			if (!(await stillMine(d))) return result.resolve({ outcome: "lost", item: id });

			await handOff(d, note.question, note.plan);

			return result.resolve({ outcome: "asked", item: id, detail: note.question });
		}

		if (value === "merging") return result.resolve(await merge(d, actor));
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

	if (d.answered) actor.send({ type: "answered" });

	return result.promise.finally(() => actor.stop());
};

/** Push the work branch, put the plan and the question on the item, and end. Each write runs once per key. */
const handOff = async (d: Driven, question: string, plan: string) => {
	const { state, id, g, branch, workSource, questions, git } = d;
	const attempt = state.runs.list(id).length;
	const key = (op: string) => ({ itemId: id, run: "ask", attempt, op });
	const calls = onceCalls({ apiVersion: ADAPTER_API_VERSION, workSource, questions }, state.ops, { run: "ask", attempt });

	await state.ops.once(key("push-branch"), {
		holds: async () => (await g(["ls-remote", "--heads", "origin", branch])).startsWith((await g(["rev-parse", "HEAD"])).trim()),
		run: async () => {
			if ((await push(git, ["--force", "origin", `HEAD:refs/heads/${branch}`])) !== "pushed") throw new Error(`could not push ${branch}`);
		},
	});

	if (plan.trim()) await calls.workSource?.comment(id, `${PLAN_MARK}\n${plan.trim()}`);

	await calls.questions?.ask(id, { text: question });
};

/** Every act that changes the world checks the claim first. */
const stillMine = async (d: Pick<Driven, "workSource" | "id" | "holder" | "config">): Promise<boolean> => (await d.workSource.renew(d.id, d.holder, claimTtlMs(d.config))).won;

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
	dir: d.dir,
	git: d.git,
	checks: d.checks,
	workSource: d.workSource,
	questions: d.questions,
	pulls: d.pulls,
	now: d.now ?? Date.now,
});

const DRAINING = "the worker restarts for an update; the next worker lands the change under its config";

/** At `merging`: the change is saved and its branch pushed, then landed by its level unless the worker drains. */
const merge = async (d: Driven, actor: AnyActor): Promise<ThinResult> => {
	if (!(await stillMine(d))) return { outcome: "lost", item: d.id };

	await prepareLanding(landContext(d));

	if (d.mayLand?.() === false) return { outcome: "held", item: d.id, why: DRAINING };

	const result = await land(landContext(d));

	if (result.outcome === "merged") actor.send({ type: "merged" });

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

	o.state.parked.put(result.item, { item: result.item, why: result.outcome, cause, since: (o.now ?? Date.now)() });
	o.state.faults.raise({
		code: rule.code,
		item: result.item,
		cause: rule.cause(result.item, cause.slice(0, CARD_EXCERPT)),
		fix: rule.fix,
		action: { label: rule.action.label, command: `hum answer ${result.item} ${rule.action.answer}` },
	});

	return result;
};
