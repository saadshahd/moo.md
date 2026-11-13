import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
	type PushOutcome,
	readOrAbsent,
} from "../adapters/git.ts";
import type { GitHubCommits } from "../adapters/github-commits.ts";
import { landOwnerCommit } from "../adapters/owner-commit.ts";
import { commandTimeoutMs } from "../exec.ts";
import { changeOf, historiesOf, readHistory } from "../adapters/history.ts";
import { DONE_STATE, markDone, parseItemFile } from "../adapters/item-file.ts";
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
import { evidenceMarkdown } from "./evidence.ts";
import { pushBase, pushCommits, pushRunBranch } from "./signed-push.ts";

const SHORT_EXCERPT = 200;

const HUM_CONFIG = ".hum/hum.json";

const NO_RULES: BranchRules = {
	requiresPullRequest: false,
	requiresSignatures: false,
	mergeMethods: undefined,
};

/** A change's pull request as it stands at one head of the run branch, which a report on it is made once for. */
export type PullAtHead = { readonly pulls: PullRequests; readonly pull: Pull; readonly head: string };

/** Everything landing a finished change reads and writes: publish's own worktree with the run branch checked out. No check of the repo runs here. */
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
	readonly dir: string;
	readonly git: Git;
	readonly workSource: WorkSource;
	readonly questions: Questions;
	/** The remote's pull requests and branch rules; undefined for a remote that is not on GitHub. */
	readonly pulls: PullRequests | undefined;
	/** The remote's branches through GitHub's API, which signs the commits it makes; undefined for a remote that is not on GitHub. */
	readonly commits: GitHubCommits | undefined;
	readonly now: () => number;
	readonly judge: ModelCall;
	/** A fresh review run on the change that ends at `head`, at its level's tier; it saves its verdict. */
	readonly reviewRun: (change: { readonly head: string; readonly diff: string; readonly level: string }) => Promise<ReviewOutcome>;
};

/** What a review run at landing came to: its verdict, or the result that stopped it, such as a usage limit. */
export type ReviewOutcome = { readonly verdict: Verdict } | { readonly halted: ThinResult };

/** The review verdict that lets a change merge. */
const REVIEW_APPROVAL = "approve";

/** The base moved after the work side checked the change on it: pushing now could land code no check ran on. */
type Moved = { readonly kind: "moved" };

/** A push that did not land: the remote refused it in `said`, or another writer moved the ref first. */
type Unpushed = Exclude<PushOutcome, { kind: "pushed" }>;

/** A push that did not land, as the pass's result: the remote's refusal ends the item stuck in its words; a push another writer beat waits for the next pass. */
export const unpushed = (id: string, ref: string, outcome: Unpushed): ThinResult =>
	outcome.kind === "refused" ? { outcome: "stuck", item: id, detail: outcome.said } : { outcome: "held", item: id, why: `another push moved ${ref} first` };

/** How a push to the base ended: the base holds the change, the base moved since the change was checked, or the push did not land. */
type BaseLanding = { readonly kind: "landed" } | Moved | Unpushed;

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

/** The run branch's diff from where it left the base to `tip`, the item's own file left out: hum's done mark is no part of the change. */
const changeDiff = ({ git, base, dir, id }: Pick<LandContext, "git" | "base" | "dir" | "id">, tip = "HEAD"): Promise<string> =>
	git.raw(["diff", ...PATCH, `origin/${base}...${tip}`, "--", ".", `:(exclude)${dir}/${id}.md`]);

/** The diff of the run branch against the base, read as the risk level reads it. */
export const changeOn = async (ctx: Pick<LandContext, "git" | "base" | "config" | "dir" | "id">): Promise<Change> => changeOf(await changeDiff(ctx), ctx.config.hum);

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
			push: (refspecs) => pushCommits({ git, base, pulls: ctx.pulls, commits: ctx.commits }, refspecs),
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

/**
 * Where the run branch holds the item's file, as a markdown item's branch does, the file is marked done in a commit of
 * its own, so the merged change itself takes the item off the ready list. A work source that keeps its items
 * elsewhere ends the item once the change merged.
 */
const markItemDone = async ({ git, clone, dir, id }: LandContext): Promise<void> => {
	const file = join(clone, dir, `${id}.md`);

	if (!existsSync(file)) return;

	const source = readFileSync(file, "utf8");

	if (parseItemFile(source).state === DONE_STATE) return;

	writeFileSync(file, markDone(source));
	await git.raw(["add", `${dir}/${id}.md`]);
	await git.raw(["commit", "-q", "-m", `hum: finish ${id}`]);
};

/** The patch id of the change against the base: a rebase keeps it. */
const patchOf = async (ctx: Pick<LandContext, "git" | "base" | "dir" | "id">): Promise<string> => (await ctx.git.raw(["patch-id", "--stable"], await changeDiff(ctx))).split(" ")[0] ?? "";

/**
 * Marks the item done on the run branch where it holds the item's file, pushes the branch and saves what its diff
 * showed, so a retry lands it without a run. The saved head is the change before hum's done mark; a push GitHub signed
 * rebuilt the change as its own commit, which is then the head, and a verdict on the old commit holds for its tree.
 * `ownerApproved` records that the owner approved this change in its review state. The same change saved again, as
 * after a rebase, keeps when it was first saved, so the owner's answers since then still count.
 */
export const prepareLanding = async (ctx: LandContext, { ownerApproved = false }: { readonly ownerApproved?: boolean } = {}): Promise<PushOutcome> => {
	const { git, id, branch, state, now } = ctx;
	const change = await changeOn(ctx);
	const built = (await git.raw(["rev-parse", "HEAD"])).trim();
	const patch = await patchOf(ctx);
	const saved = state.landings.get(id);
	const kept = saved?.patch === patch ? saved : undefined;

	await markItemDone(ctx);
	const pushed = await pushRunBranch(ctx, branch);

	if (pushed.kind !== "pushed") return pushed;

	const head = (await isAncestor(git, { ancestor: built, descendant: "HEAD" })) ? built : (await git.raw(["rev-parse", "HEAD"])).trim();
	const verdict = state.verdicts.get(id);

	if (head !== built && verdict?.head === built) state.verdicts.put(id, { ...verdict, head });

	state.landings.put(id, { item: id, branch, since: kept?.since ?? now(), change, head, ownerApproved: ownerApproved || kept?.ownerApproved === true, lostRaces: kept?.lostRaces ?? 0, alignment: kept?.alignment, patch });

	return pushed;
};

/** Whether the base already holds the change, as after a push whose op was not marked done. */
const isOnBase = async ({ git, base }: LandContext): Promise<boolean> => {
	await git.raw(["fetch", "-q", "origin", base]);

	return isAncestor(git, { ancestor: "HEAD", descendant: `origin/${base}` });
};

/**
 * The change on the base the work side checked it on, as a work pass leaves it: rebased there when it does not grow
 * from it, and checked again; else why it cannot merge there.
 */
export const rebaseOnto = async ({ git, clone, env, checks, config, base }: { readonly git: Git; readonly clone: string; readonly env: Readonly<Record<string, string>>; readonly checks: readonly string[]; readonly config: Config; readonly base: string }, onto: string): Promise<string | undefined> => {
	if (await isAncestor(git, { ancestor: onto, descendant: "HEAD" })) return undefined;

	const rebased = await git.run(["rebase", "-q", onto]);

	if (rebased.code !== 0) {
		await git.run(["rebase", "--abort"]);

		return `the change conflicts with the newest ${base}: ${rebased.stderr.trim().slice(0, SHORT_EXCERPT)}`;
	}

	const failure = await runChecks(checks, clone, { env, timeoutMs: checksTimeoutMs(config.hum) });

	return failure && `the checks fail on the newest ${base}: ${failure.slice(0, SHORT_EXCERPT)}`;
};

const pushBranchAndBase = async (ctx: LandContext): Promise<PushOutcome> => {
	const toBranch = await pushRunBranch(ctx, ctx.branch);

	return toBranch.kind === "pushed" ? pushBase(ctx) : toBranch;
};

/** Whether the change holds the item's file marked done, so the merge itself took the item off the ready list. */
const endedByChange = async ({ git, dir, id }: LandContext): Promise<boolean> => {
	const source = await readOrAbsent(git, ["show", `HEAD:${dir}/${id}.md`]);

	return source !== undefined && parseItemFile(source).state === DONE_STATE;
};

/**
 * The change is on the base: its item ends at the work source unless the change ended it, then the merge is recorded.
 * A failed end leaves the landing saved, so the next pass ends it again.
 */
const finish = async (ctx: LandContext): Promise<ThinResult> => {
	const { state, git, id, item, workSource, now } = ctx;

	if (!(await endedByChange(ctx))) await workSource.finish(item.id);
	await recordMerged(state, { git, remote: "origin" }, { item: id, sha: (await git.raw(["rev-parse", "HEAD"])).trim(), at: now() });

	return { outcome: "merged", item: id };
};

/** Pushes the change to the base once, only as it grows from the base as it stands: a base that moved after the change was checked waits for the next pass to check it again. */
const pushToBase = async (ctx: LandContext): Promise<BaseLanding> => {
	if (await isOnBase(ctx)) return LANDED;

	if (!(await isAncestor(ctx.git, { ancestor: `origin/${ctx.base}`, descendant: "HEAD" }))) return { kind: "moved" };

	const pushed = await ctx.state.ops.once({ itemId: ctx.id, run: "merge", attempt: 0, op: "push-base" }, { holds: () => isOnBase(ctx), run: () => pushBranchAndBase(ctx), isDone: ({ kind }) => kind === "pushed" });

	return pushed.kind === "skipped" || pushed.value.kind === "pushed" ? LANDED : pushed.value;
};

/** What the change's pull request says: the text the run wrote under the repo's own rules, else the item's title, then its evidence, then hum's word on the merge and the item. */
const pullRequestOf = ({ state, id, item }: LandContext, merging: string) => {
	const written = state.pullRequests.get(id);

	return {
		title: written?.title ?? `hum: ${item.title}`,
		body: [written?.body, written?.evidence && evidenceMarkdown(written.evidence), merging, `Item ${id}.`].filter(Boolean).join("\n\n"),
	};
};

/** One pull request from the run branch: it merges itself once GitHub's required checks pass when the change is cleared, and waits for the owner otherwise. */
const throughPullRequest = async (
	ctx: LandContext,
	{ pulls, autoMerge, route, rules, why }: { readonly pulls: PullRequests; readonly autoMerge: boolean; readonly route: Route; readonly rules: BranchRules; readonly why: string },
): Promise<ThinResult> => {
	const { id, branch, base, config } = ctx;
	const pull = (await pulls.find(branch)) ?? (await pulls.open({ head: branch, base, ...pullRequestOf(ctx, autoMerge ? `Level ${route.level.name}: it merges once the required checks pass.` : `Not merged by hum: ${why}.`) }));

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

/** The card of a base that other pushes moved first on `mergeTries` passes in a row. It stands while the item stays held; the pass that decides the item another way clears it. */
export const BASE_CONTENDED = "base-contended";

/** Counts a pass that lost the race to the base, and raises one card once `mergeTries` passes in a row did. */
const loseRace = ({ state, id, base, config }: LandContext, why: string): ThinResult => {
	const saved = state.landings.get(id);
	const lost = (saved?.lostRaces ?? 0) + 1;

	if (saved) state.landings.put(id, { ...saved, lostRaces: lost });

	if (lost >= config.hum.mergeTries)
		state.faults.raise({
			code: BASE_CONTENDED,
			item: id,
			cause: `${id} lost the race to ${base} on ${lost} passes in a row: another push moved ${base} first each time`,
			fix: `hum tries again each pass. If this card stays, find what keeps pushing to ${base}, or raise mergeTries in .hum/hum.json.`,
		});

	return { outcome: "held", item: id, why };
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

	if (landed.kind === "conflict") return loseRace(ctx, `another push moved ${ctx.base} first`);

	if (landed.kind === "moved") return loseRace(ctx, `${ctx.base} moved after the change was checked on it; the next pass checks it there`);

	return finish(ctx);
};

/**
 * Lands a change saved by `prepareLanding`, by its level under the policy as it stands now: an answered level
 * becomes a path rule first, an unclear change asks once, and the target branch's rules pick a push or a pull request.
 */
export const land = async (ctx: LandContext): Promise<ThinResult> => {
	const saved = ctx.state.landings.get(ctx.id);

	if (!saved) throw new Error(`no landing is saved for ${ctx.id}`);

	// A change of no files, such as a split item's, whose branch the base already holds has nothing left to land.
	if (saved.change.paths.length === 0 && (await isOnBase(ctx))) return finish(ctx);

	const first = await placementOf(ctx, saved.change);
	const answered = answeredLevel(ctx.item, saved.since, levelNames(ctx.config));
	const learns = first.placement.unclear.length > 0 && answered !== undefined;

	const unlearned = learns ? await learnRules(ctx, first.placement.unclear, answered) : undefined;

	if (unlearned) return unpushed(ctx.id, ctx.base, unlearned);

	const { placement, policy } = learns
		? await placementOf(ctx, saved.change)
		: first;

	if (placement.unclear.length > 0) await askUnclear(ctx, placement.unclear);

	const diff = await changeDiff(ctx, saved.head);
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
