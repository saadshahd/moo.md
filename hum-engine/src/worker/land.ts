import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import {
	type Item,
	type Questions,
	type WorkSource,
} from "../adapter-api.ts";
import {
	type Git,
	gitIn,
	isAncestor,
	PATCH,
	push,
	type PushOutcome,
} from "../adapters/git.ts";
import { landOwnerCommit } from "../adapters/owner-commit.ts";
import { commandTimeoutMs } from "../exec.ts";
import { changeOf, historiesOf, readHistory } from "../adapters/history.ts";
import { markDone } from "../adapters/item-file.ts";
import {
	type BranchRules,
	methodFor,
	type Pull,
	type PullRequests,
} from "../adapters/pull-requests.ts";
import type { ModelCall } from "../adapters/model-call.ts";
import type { Config } from "../config/load.ts";
import type { Boundary } from "../config/schema.ts";
import { alignedPlacement, alignmentQuestion, doesGateAlignment } from "../decide/alignment.ts";
import {
	isCleared,
	type Landing,
	landingOf,
	doesNeedReviewRun,
	OWNER_APPROVAL,
	type Route,
	routeOf,
	type Unclear,
	waitReason,
} from "../decide/merge.ts";
import { isTrusted } from "../decide/prose.ts";
import {
	type Change,
	placeChange,
	type Placement,
	type Policy,
} from "../decide/risk.ts";
import type { State } from "../state/open.ts";
import type { Landing as SavedLanding, Verdict } from "../state/saved.ts";
import { PLAIN_QUESTIONS } from "../decide/question.ts";
import { checksTimeoutMs, runChecks } from "./checks.ts";
import { recordMerged } from "./merged.ts";
import { blockedPaths, brokenCommits } from "../loop/breaks.ts";
import { queueQuestion, releaseQuestions } from "./questions.ts";
import { pickedAnswer } from "./thread.ts";
import { reportAlignment } from "./alignment-report.ts";
import { reportTaste } from "./taste.ts";
import type { ThinResult } from "./thin-path.ts";

const SHORT_EXCERPT = 200;

const HUM_CONFIG = ".hum/hum.json";

const NO_RULES: BranchRules = {
	requiresPullRequest: false,
	mergeMethods: undefined,
};

/** A change's pull request as it stands at one head of the run branch, which a report on it is made once for. */
export type PullAtHead = { readonly pulls: PullRequests; readonly pull: Pull; readonly head: string };

/** Everything landing a finished change reads and writes. The clone has the run branch checked out and the base fetched. */
export type LandContext = {
	readonly state: State;
	readonly config: Config;
	readonly kind: string;
	readonly id: string;
	readonly item: Item;
	readonly branch: string;
	readonly base: string;
	readonly remote: string;
	readonly clone: string;
	/** What the run's folder adds to the environment of the repo's checks. */
	readonly env: Readonly<Record<string, string>>;
	readonly dir: string;
	readonly git: Git;
	readonly checks: readonly string[];
	readonly workSource: WorkSource;
	readonly questions: Questions;
	/** The remote's pull requests and branch rules; undefined for a remote that is not on GitHub. */
	readonly pulls: PullRequests | undefined;
	readonly now: () => number;
	readonly judge: ModelCall;
	/** A fresh review run on the change that ends at `head`, at its level's tier; it saves its verdict. */
	readonly reviewRun: (change: { readonly head: string; readonly diff: string; readonly level: string }) => Promise<ReviewOutcome>;
};

/** What a review run at landing came to: its verdict, or the result that stopped it, such as a usage limit. */
export type ReviewOutcome = { readonly verdict: Verdict } | { readonly halted: ThinResult };

/** The review verdict that lets a change merge. */
const REVIEW_APPROVAL = "approve";

/** Why the change cannot merge on the newest base: it conflicts there, or its checks fail there. */
type Stale = { readonly kind: "stale"; readonly why: string };

/** A push that did not land: the remote refused it in `said`, or another writer moved the ref first. */
type Unpushed = Exclude<PushOutcome, { kind: "pushed" }>;

/** A push that did not land, as the pass's result: the remote's refusal ends the item stuck in its words; a push another writer beat waits for the next pass. */
export const unpushed = (id: string, ref: string, outcome: Unpushed): ThinResult =>
	outcome.kind === "refused" ? { outcome: "stuck", item: id, detail: outcome.said } : { outcome: "held", item: id, why: `another push moved ${ref} first` };

/** How a push to the base ended: the base holds the change, it cannot merge on the newest base, or the push did not land. */
type BaseLanding = { readonly kind: "landed" } | Stale | Unpushed;

const LANDED: BaseLanding = { kind: "landed" };

/** The glob a new path rule takes for a path no rule places: its folder, or the file itself at the top. */
export const ruleGlobFor = (path: string): string =>
	dirname(path) === "." ? path : `${dirname(path)}/**`;

const levelNames = (config: Config): readonly string[] =>
	config.hum.levels.map(({ name }) => name);

/** The config's risk policy with every rule the owner's answers added since it was loaded. */
const policyOf = ({
	config,
	state,
}: Pick<LandContext, "config" | "state">): Policy => ({
	...config.hum,
	paths: [
		...config.hum.paths,
		...state.learned.list().map(({ glob, level }) => ({ glob, level })),
	],
});

/** The change's level under the current policy and the base's own history. */
export const placementOf = async (
	ctx: Pick<LandContext, "config" | "state" | "git" | "base" | "now"> & { readonly kind?: string },
	change: Change,
): Promise<{ placement: Placement; policy: Policy }> => {
	const policy = policyOf(ctx);

	const histories = historiesOf(
		await readHistory(ctx.git, `origin/${ctx.base}`, ctx.config.hum),
			{ ...ctx.config.hum, paths: policy.paths },
		brokenCommits(ctx.state),
	);

	return {
		placement: placeChange(change, policy, histories, {
			now: ctx.now(),
			base: ctx.base,
			kindFloor: ctx.kind === undefined ? undefined : ctx.config.hum.kindFloors[ctx.kind],
			blocked: blockedPaths(ctx.state),
		}),
		policy,
	};
};

/** The diff of the run branch against the base, read as the risk level reads it. */
export const changeOn = async ({
	git,
	base,
	config,
}: Pick<LandContext, "git" | "base" | "config">): Promise<Change> =>
	changeOf(await git.raw(["diff", ...PATCH, `origin/${base}...HEAD`]), config.hum);

/** The level the owner picked for unclear paths, answered since the change was saved. */
const answeredLevel = (item: Item, since: number, levels: readonly string[]): string | undefined => pickedAnswer(item.thread, levels, since)?.option;

const askUnclear = async (ctx: LandContext, unclear: readonly string[]): Promise<void> => {
	const globs = [...new Set(unclear.map(ruleGlobFor))];

	queueQuestion(ctx, ctx.item, { text: PLAIN_QUESTIONS.level, options: levelNames(ctx.config), detail: `${globs.join(", ")} match no path rule.` }, "level");
	await releaseQuestions(ctx);
};

const RawPaths = z.looseObject({ paths: z.array(z.unknown()).default([]) });

/** Commits the owner's answer as path rules in the base's `hum.json`, with hooks off, and saves them for the view's undo. Returns why the rules did not land, or nothing once they did. */
const learnRules = async (
	ctx: LandContext,
	unclear: readonly string[],
	level: string,
): Promise<Unpushed | undefined> => {
	const { state, config, id, base, remote, now } = ctx;
	const globs = [...new Set(unclear.map(ruleGlobFor))];
	const scratch = mkdtempSync(join(tmpdir(), "hum-rule-"));
	const timeoutMs = commandTimeoutMs(config.hum);
	const git = gitIn(scratch, { identity: config.hum.commitIdentity, timeoutMs });

	try {
		await gitIn(tmpdir(), { timeoutMs }).raw([
			"clone",
			"-q",
			"--depth",
			"1",
			"--branch",
			base,
			remote,
			scratch,
		]);

		const file = join(scratch, HUM_CONFIG);
		const raw = RawPaths.parse(JSON.parse(readFileSync(file, "utf8")));

		writeFileSync(
			file,
			`${JSON.stringify({ ...raw, paths: [...raw.paths, ...globs.map((glob) => ({ glob, level }))] }, null, "\t")}\n`,
		);
		await git.raw([
			"commit",
			"-q",
			"-a",
			"-m",
			`hum: ${globs.join(", ")} at level ${level}`,
			"-m",
			`The owner answered on item ${id}.`,
		]);

		const commit = (await git.raw(["rev-parse", "HEAD"])).trim();

		const landed = await landOwnerCommit({
			sha: commit,
			base,
			label: id,
			title: `hum: ${globs.join(", ")} at level ${level}`,
			body: `The owner answered on item ${id}: ${globs.join(", ")} at level ${level}.`,
			branchPrefix: config.hum.ownerBranchPrefix,
			mergeMethod: config.hum.mergeMethod,
			pulls: ctx.pulls,
			push: (refspecs) => push(git, ["origin", ...refspecs]),
		});

		if (landed.via === "refused") return { kind: "refused", said: landed.said };

		if (landed.via === "conflict") return { kind: "conflict" };

		for (const glob of globs)
			state.learned.put(glob, { glob, level, item: id, commit, pull: landed.via === "pull-request" ? landed.pull.url : undefined, at: now() });

		return undefined;
	} finally {
		rmSync(scratch, { recursive: true, force: true });
	}
};

/** Marks the item done on the run branch, pushes the branch and saves what its diff showed, so a retry lands it without a run. `ownerApproved` records that the owner approved this change in its review state. */
export const prepareLanding = async (ctx: LandContext, { ownerApproved = false }: { readonly ownerApproved?: boolean } = {}): Promise<PushOutcome> => {
	const { git, clone, dir, id, branch, state, now } = ctx;
	const change = await changeOn(ctx);
	const head = (await git.raw(["rev-parse", "HEAD"])).trim();
	const file = join(clone, dir, `${id}.md`);

	writeFileSync(file, markDone(readFileSync(file, "utf8")));
	await git.raw(["add", `${dir}/${id}.md`]);
	await git.raw(["commit", "-q", "-m", `hum: finish ${id}`]);
	const pushed = await push(git, ["--force", "origin", `HEAD:refs/heads/${branch}`]);

	if (pushed.kind === "pushed") state.landings.put(id, { item: id, branch, since: now(), change, head, ownerApproved });

	return pushed;
};

/** Whether the base already holds the change, as after a push whose op was not marked done. */
const isOnBase = async ({ git, base }: LandContext): Promise<boolean> => {
	await git.raw(["fetch", "-q", "origin", base]);

	return isAncestor(git, { ancestor: "HEAD", descendant: `origin/${base}` });
};

/** The change on the newest base: when the base moved it is rebased and the checks run again; else why it cannot merge there. */
const ontoNewestBase = async ({ git, base, clone, env, checks, config }: LandContext): Promise<Stale | undefined> => {
	await git.raw(["fetch", "-q", "origin", base]);

	if (await isAncestor(git, { ancestor: `origin/${base}`, descendant: "HEAD" })) return undefined;

	const rebased = await git.run(["rebase", "-q", `origin/${base}`]);

	if (rebased.code !== 0) {
		await git.run(["rebase", "--abort"]);

		return { kind: "stale", why: `the change conflicts with the newest ${base}: ${rebased.stderr.trim().slice(0, SHORT_EXCERPT)}` };
	}

	const failure = await runChecks(checks, clone, { env, timeoutMs: checksTimeoutMs(config.hum) });

	return failure ? { kind: "stale", why: `the checks fail on the newest ${base}: ${failure.slice(0, SHORT_EXCERPT)}` } : undefined;
};

const pushBranchAndBase = async ({ git, base, branch }: LandContext): Promise<PushOutcome> => {
	const toBranch = await push(git, ["--force", "origin", `HEAD:refs/heads/${branch}`]);

	return toBranch.kind === "pushed" ? push(git, ["origin", `HEAD:refs/heads/${base}`]) : toBranch;
};

const finish = async ({ state, git, id, now }: LandContext): Promise<ThinResult> => {
	recordMerged(state, { item: id, sha: (await git.raw(["rev-parse", "HEAD"])).trim(), at: now() });

	return { outcome: "merged", item: id };
};

/** Pushes the change to the base once, rechecked on the newest base before each try; a base another push moved first is tried again, up to `mergeTries` pushes. */
const pushToBase = async (ctx: LandContext): Promise<BaseLanding> => {
	if (await isOnBase(ctx)) return LANDED;

	for (let tries = 0; tries < ctx.config.hum.mergeTries; tries++) {
		const stale = await ontoNewestBase(ctx);

		if (stale) return stale;

		const pushed = await ctx.state.ops.once({ itemId: ctx.id, run: "merge", attempt: 0, op: "push-base" }, { holds: () => isOnBase(ctx), run: () => pushBranchAndBase(ctx), isDone: ({ kind }) => kind === "pushed" });

		if (pushed.kind === "skipped" || pushed.value.kind === "pushed") return LANDED;

		if (pushed.value.kind === "refused") return pushed.value;
	}

	return { kind: "conflict" };
};

/** One pull request from the run branch: it merges itself once GitHub's required checks pass when the change is cleared, and waits for the owner otherwise. */
const throughPullRequest = async (
	ctx: LandContext,
	{ pulls, autoMerge, route, rules, why }: { readonly pulls: PullRequests; readonly autoMerge: boolean; readonly route: Route; readonly rules: BranchRules; readonly why: string },
): Promise<ThinResult> => {
	const { id, branch, base, item, config } = ctx;
	const body = `${autoMerge ? `Level ${route.level.name}: it merges once the required checks pass.` : `Not merged by hum: ${why}.`}\n\nItem ${id}.`;

	const pull =
		(await pulls.find(branch)) ??
		(await pulls.open({
			head: branch,
			base,
			title: `hum: ${item.title}`,
			body,
		}));

	if (pull.state === "MERGED") return finish(ctx);

	if (pull.state === "CLOSED")
		return {
			outcome: "review",
			item: id,
			detail: `its pull request was closed unmerged: ${pull.url}`,
		};

	const atHead: PullAtHead = { pulls, pull, head: ctx.state.landings.get(id)?.head ?? branch };

	await reportTaste(ctx, atHead);
	await reportAlignment(ctx, atHead);

	const armed = await pulls.autoMerge(
		pull,
		autoMerge,
		methodFor(config.hum.mergeMethod, rules.mergeMethods),
	);

	if (armed === "merged") return finish(ctx);

	if (armed === "armed" && pull.behind) await pulls.update(pull);

	return { outcome: "landing", item: id, detail: pull.url };
};

/** A push the remote refused: on GitHub the rules are read again and the change goes through a pull request; elsewhere the item ends stuck in the remote's words. */
const afterRefusal = async (
	ctx: LandContext,
	{ cleared, route, why, said }: { readonly cleared: boolean; readonly route: Route; readonly why: string; readonly said: string },
): Promise<ThinResult> => {
	if (!ctx.pulls) return unpushed(ctx.id, ctx.base, { kind: "refused", said: `${said}; ${ctx.base} is not on GitHub, so no pull request can land it` });

	return throughPullRequest(
		ctx,
		{ pulls: ctx.pulls, autoMerge: cleared, route, rules: await ctx.pulls.rules(ctx.base, true), why },
	);
};

const landBy = async (
	ctx: LandContext,
	landing: Landing,
	route: Route,
	rules: BranchRules,
	why: string,
): Promise<ThinResult> => {
	if (landing.via === "wait")
		return { outcome: "review", item: ctx.id, detail: why };

	if (landing.via === "pull-request" && ctx.pulls)
		return throughPullRequest(ctx, { pulls: ctx.pulls, autoMerge: landing.autoMerge, route, rules, why });

	const landed = await pushToBase(ctx);

	if (landed.kind === "refused") return afterRefusal(ctx, { cleared: true, route, why, said: landed.said });

	if (landed.kind === "conflict") return unpushed(ctx.id, ctx.base, landed);

	return landed.kind === "stale" ? { outcome: "review", item: ctx.id, detail: landed.why } : finish(ctx);
};

/**
 * Lands a change saved by `prepareLanding`, by its level under the policy as it stands now: an answered level
 * becomes a path rule first, an unclear change asks once, and the target branch's rules pick a push or a pull request.
 */
export const land = async (ctx: LandContext): Promise<ThinResult> => {
	const saved = ctx.state.landings.get(ctx.id);

	if (!saved) throw new Error(`no landing is saved for ${ctx.id}`);

	const first = await placementOf(ctx, saved.change);
	const answered = answeredLevel(ctx.item, saved.since, levelNames(ctx.config));
	const learns = first.placement.unclear.length > 0 && answered !== undefined;

	const unlearned = learns ? await learnRules(ctx, first.placement.unclear, answered) : undefined;

	if (unlearned) return unpushed(ctx.id, ctx.base, unlearned);

	const { placement, policy } = learns
		? await placementOf(ctx, saved.change)
		: first;

	if (placement.unclear.length > 0) await askUnclear(ctx, placement.unclear);

	const diff = await ctx.git.raw(["diff", ...PATCH, `origin/${ctx.base}...${saved.head}`]);
	const alignment = saved.change.paths.length > 0 ? await alignmentOf(ctx, saved, diff) : undefined;
	const aligned = doesGateAlignment(ctx.config.hum) && alignment && "graded" in alignment ? alignedPlacement(placement, alignment.graded, ctx.config.hum) : placement;
	const routeWith = (verdict?: Verdict): Route => routeOf(aligned, policy.paths, ctx.kind, saved.change.paths, abstentionsOf(ctx, alignment, verdict));
	const placed = routeWith();
	const reviewed = doesNeedReviewRun(placed) ? await verdictOn(ctx, { head: saved.head, diff, level: placed.level.name }) : undefined;

	if (reviewed && "halted" in reviewed) return reviewed.halted;

	const verdict = reviewed?.verdict;
	const route = routeWith(verdict);
	const approvals = { review: verdict?.event === REVIEW_APPROVAL, owner: saved.ownerApproved || pickedAnswer(ctx.item.thread, [OWNER_APPROVAL], saved.since) !== undefined };
	const why = verdict && verdict.event !== REVIEW_APPROVAL ? `the review run answered ${verdict.event}: ${verdict.reason}` : waitReason(route);
	const rules = ctx.pulls ? await ctx.pulls.rules(ctx.base) : NO_RULES;

	return landBy(ctx, landingOf({ requiresPullRequest: rules.requiresPullRequest, cleared: isCleared(route, approvals) }), route, rules, why);
};

/** The alignment call's grades for a saved change, made once and kept with the landing. */
const alignmentOf = async (ctx: LandContext, saved: SavedLanding, diff: string): Promise<NonNullable<SavedLanding["alignment"]>> => {
	if (saved.alignment) return saved.alignment;

	const judged = await ctx.judge({ ...alignmentQuestion(ctx.item, diff, ctx.config.hum), item: ctx.id });
	const alignment = judged.kind === "picked" ? { graded: judged.value } : { abstained: judged.why };

	ctx.state.landings.put(ctx.id, { ...saved, alignment });

	return alignment;
};

/** The verdict on the change at `head`: the one saved for it, else a fresh review run. */
const verdictOn = async (ctx: LandContext, change: Parameters<LandContext["reviewRun"]>[0]): Promise<ReviewOutcome> => {
	const saved = ctx.state.verdicts.get(ctx.id);

	return saved?.head === change.head ? { verdict: saved } : ctx.reviewRun(change);
};

const abstained = (boundary: Boundary, why: string): Unclear => ({ cause: "abstained", boundary, why });

const unmeasured = (models: readonly string[]): string => `${models.join(", ") || "no model"} has no measured rate that meets the bar`;

/** Every model judgment behind the change that abstained, or came from a model id its boundary was not measured on. */
const abstentionsOf = (ctx: LandContext, alignment: SavedLanding["alignment"], verdict: Verdict | undefined): Unclear[] => {
	const isMeasured = (boundary: Boundary, models: readonly string[]): boolean => isTrusted(models, boundary, ctx.config.hum);
	const kind = ctx.state.itemKinds.get(ctx.id);
	const plan = ctx.state.plans.get(ctx.id);

	return [
		...(kind?.from === "fallback" ? [abstained("kind", kind.why)] : []),
		...(doesGateAlignment(ctx.config.hum) && alignment && "abstained" in alignment ? [abstained("alignment", alignment.abstained)] : []),
		...(plan && !isMeasured("plan-outcome", plan.models) ? [abstained("plan-outcome", unmeasured(plan.models))] : []),
		...(verdict && !isMeasured("review-verdict", verdict.models) ? [abstained("review-verdict", unmeasured(verdict.models))] : []),
	];
};
