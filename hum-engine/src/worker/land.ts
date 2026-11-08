import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import pRetry from "p-retry";
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
	PushRefused,
} from "../adapters/git.ts";
import { type CommitLanded, landOwnerCommit } from "../adapters/owner-commit.ts";
import { changeOf, historiesOf, readHistory } from "../adapters/history.ts";
import { markDone } from "../adapters/item-file.ts";
import {
	type BranchRules,
	methodFor,
	type PullRequests,
} from "../adapters/pull-requests.ts";
import type { ModelCall } from "../adapters/model-call.ts";
import type { Config } from "../config/load.ts";
import type { Boundary } from "../config/schema.ts";
import { alignedPlacement, alignmentQuestion } from "../decide/alignment.ts";
import {
	isCleared,
	type Landing,
	landingOf,
	needsReviewRun,
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
import { runChecks } from "./checks.ts";
import { queueQuestion, releaseQuestions } from "./questions.ts";
import type { ThinResult } from "./thin-path.ts";

const SHORT_EXCERPT = 200;

const HUM_CONFIG = ".hum/hum.json";

const NO_RULES: BranchRules = {
	requiresPullRequest: false,
	mergeMethods: undefined,
};

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
export const REVIEW_APPROVAL = "approve";

/** The change cannot merge on the newest base: it conflicts, or its checks fail there. */
class StaleMerge extends Error {
	override name = "StaleMerge";
}

/** Another writer moved the base between the fetch and the push. */
class BaseMoved extends Error {
	override name = "BaseMoved";
}

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
	ctx: Pick<LandContext, "config" | "state" | "git" | "base" | "now">,
	change: Change,
): Promise<{ placement: Placement; policy: Policy }> => {
	const policy = policyOf(ctx);

	const histories = historiesOf(
		await readHistory(ctx.git, `origin/${ctx.base}`, ctx.config.hum),
		{ ...ctx.config.hum, paths: policy.paths },
	);

	return {
		placement: placeChange(change, policy, histories, {
			now: ctx.now(),
			base: ctx.base,
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

const isOwnerApproval =
	(since: number) =>
	(entry: Item["thread"][number]): boolean =>
		entry.kind === "answer" &&
		entry.option === OWNER_APPROVAL &&
		entry.at >= since;

/** The level the owner picked for unclear paths, answered since the change was saved. */
const answeredLevel = (
	item: Item,
	since: number,
	levels: readonly string[],
): string | undefined =>
	item.thread.findLast(
		(entry) =>
			entry.kind === "answer" &&
			entry.at >= since &&
			entry.option !== undefined &&
			levels.includes(entry.option),
	)?.option;

const askUnclear = async (ctx: LandContext, unclear: readonly string[]): Promise<void> => {
	const globs = [...new Set(unclear.map(ruleGlobFor))];

	queueQuestion(ctx, ctx.item, { text: PLAIN_QUESTIONS.level, options: levelNames(ctx.config), detail: `${globs.join(", ")} match no path rule.` }, "level");
	await releaseQuestions(ctx);
};

const RawPaths = z.looseObject({ paths: z.array(z.unknown()).default([]) });

/** Commits the owner's answer as path rules in the base's `hum.json`, with hooks off, and saves them for the view's undo. */
const learnRules = async (
	ctx: LandContext,
	unclear: readonly string[],
	level: string,
): Promise<CommitLanded> => {
	const { state, config, id, base, remote, now } = ctx;
	const globs = [...new Set(unclear.map(ruleGlobFor))];
	const scratch = mkdtempSync(join(tmpdir(), "hum-rule-"));
	const git = gitIn(scratch, { identity: config.hum.commitIdentity });

	try {
		await gitIn(tmpdir()).raw([
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

		if (landed.via === "conflict")
			throw new Error(
				`another push moved ${base} before the path rule for ${id} landed`,
			);

		for (const glob of globs)
			state.learned.put(glob, { glob, level, item: id, commit, pull: landed.via === "pull-request" ? landed.pull.url : undefined, at: now() });

		return landed;
	} finally {
		rmSync(scratch, { recursive: true, force: true });
	}
};

/** Marks the item done on the run branch, pushes the branch and saves what its diff showed, so a retry lands it without a run. `ownerApproved` records that the owner approved this change in its review state. */
export const prepareLanding = async (ctx: LandContext, ownerApproved = false): Promise<void> => {
	const { git, clone, dir, id, branch, state, now } = ctx;
	const change = await changeOn(ctx);
	const head = (await git.raw(["rev-parse", "HEAD"])).trim();
	const file = join(clone, dir, `${id}.md`);

	writeFileSync(file, markDone(readFileSync(file, "utf8")));
	await git.raw(["add", `${dir}/${id}.md`]);
	await git.raw(["commit", "-q", "-m", `hum: finish ${id}`]);
	await push(git, ["--force", "origin", `HEAD:refs/heads/${branch}`]);
	state.landings.put(id, { item: id, branch, since: now(), change: { ...change, paths: [...change.paths] }, head, ownerApproved });
};

/** A merge is rechecked on the newest base: when the base moved, the change is rebased and the checks run again. */
const pushOntoNewestBase = async ({
	git,
	base,
	branch,
	clone,
	checks,
}: LandContext): Promise<void> => {
	await git.raw(["fetch", "-q", "origin", base]);

	if (!(await isAncestor(git, `origin/${base}`, "HEAD"))) {
		const rebased = await git.run(["rebase", "-q", `origin/${base}`]);

		if (rebased.code !== 0) {
			await git.run(["rebase", "--abort"]);

			throw new StaleMerge(
				`the change conflicts with the newest ${base}: ${rebased.stderr.trim().slice(0, SHORT_EXCERPT)}`,
			);
		}

		const failure = await runChecks(checks, clone);

		if (failure)
			throw new StaleMerge(
				`the checks fail on the newest ${base}: ${failure.slice(0, SHORT_EXCERPT)}`,
			);
	}

	await push(git, ["--force", "origin", `HEAD:refs/heads/${branch}`]);

	if ((await push(git, ["origin", `HEAD:refs/heads/${base}`])) === "conflict")
		throw new BaseMoved(`another push moved ${base} first`);
};

const finish = async ({ state, git, id }: LandContext): Promise<ThinResult> => {
	const sha = (await git.raw(["rev-parse", "HEAD"])).trim();

	state.landings.remove(id);
	state.plans.remove(id);
	state.verdicts.remove(id);
	state.events.add({
		source: "work-source",
		sourceId: `merged:${sha}`,
		itemId: id,
		type: "merged",
		payload: {},
	});

	return { outcome: "merged", item: id };
};

const pushToBase = async (ctx: LandContext): Promise<void> => {
	await ctx.state.ops.once(
		{ itemId: ctx.id, run: "merge", attempt: 0, op: "push-base" },
		{
			holds: async () => {
				await ctx.git.raw(["fetch", "-q", "origin", ctx.base]);

				return isAncestor(ctx.git, "HEAD", `origin/${ctx.base}`);
			},
			run: () =>
				pRetry(() => pushOntoNewestBase(ctx), {
					retries: ctx.config.hum.mergeTries - 1,
					minTimeout: 0,
					shouldRetry: ({ error }) => error instanceof BaseMoved,
				}),
		},
	);
};

/** One pull request from the run branch: it merges itself once GitHub's required checks pass when the change is cleared, and waits for the owner otherwise. */
const throughPullRequest = async (
	ctx: LandContext,
	pulls: PullRequests,
	autoMerge: boolean,
	route: Route,
	rules: BranchRules,
	why: string,
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

	const armed = await pulls.autoMerge(
		pull,
		autoMerge,
		methodFor(config.hum.mergeMethod, rules.mergeMethods),
	);

	if (armed === "merged") return finish(ctx);

	if (armed === "armed" && pull.behind) await pulls.update(pull);

	return { outcome: "landing", item: id, detail: pull.url };
};

/** A push the remote refused, on GitHub: the rules are read again and the change goes through a pull request. */
const afterRefusal = async (
	ctx: LandContext,
	cleared: boolean,
	route: Route,
	why: string,
): Promise<ThinResult> => {
	if (!ctx.pulls)
		throw new PushRefused(
			`the remote refused the push of ${ctx.id} to ${ctx.base}, and it is not on GitHub`,
		);

	return throughPullRequest(
		ctx,
		ctx.pulls,
		cleared,
		route,
		await ctx.pulls.rules(ctx.base, true),
		why,
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
		return throughPullRequest(ctx, ctx.pulls, landing.autoMerge, route, rules, why);

	try {
		await pushToBase(ctx);

		return await finish(ctx);
	} catch (error) {
		if (error instanceof StaleMerge)
			return { outcome: "review", item: ctx.id, detail: error.message };

		if (error instanceof PushRefused) return afterRefusal(ctx, true, route, why);

		throw error;
	}
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

	if (learns) await learnRules(ctx, first.placement.unclear, answered);

	const { placement, policy } = learns
		? await placementOf(ctx, saved.change)
		: first;

	if (placement.unclear.length > 0) await askUnclear(ctx, placement.unclear);

	const diff = await ctx.git.raw(["diff", ...PATCH, `origin/${ctx.base}...${saved.head}`]);
	const alignment = saved.change.paths.length > 0 ? await alignmentOf(ctx, saved, diff) : undefined;
	const aligned = alignment && "graded" in alignment ? alignedPlacement(placement, alignment.graded, ctx.config.hum) : placement;
	const routeWith = (verdict?: Verdict): Route => routeOf(aligned, policy.paths, ctx.kind, saved.change.paths, abstentionsOf(ctx, alignment, verdict));
	const placed = routeWith();
	const reviewed = needsReviewRun(placed) ? await verdictOn(ctx, { head: saved.head, diff, level: placed.level.name }) : undefined;

	if (reviewed && "halted" in reviewed) return reviewed.halted;

	const verdict = reviewed?.verdict;
	const route = routeWith(verdict);
	const approvals = { review: verdict?.event === REVIEW_APPROVAL, owner: saved.ownerApproved || ctx.item.thread.some(isOwnerApproval(saved.since)) };
	const why = verdict && verdict.event !== REVIEW_APPROVAL ? `the review run answered ${verdict.event}: ${verdict.reason}` : waitReason(route);
	const rules = ctx.pulls ? await ctx.pulls.rules(ctx.base) : NO_RULES;

	return landBy(ctx, landingOf(rules.requiresPullRequest, isCleared(route, approvals)), route, rules, why);
};

/** The alignment call's grades for a saved change, made once and kept with the landing. */
const alignmentOf = async (ctx: LandContext, saved: SavedLanding, diff: string): Promise<NonNullable<SavedLanding["alignment"]>> => {
	if (saved.alignment) return saved.alignment;

	const judged = await ctx.judge(alignmentQuestion(ctx.item, diff, ctx.config.hum));
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
	const measured = (boundary: Boundary, models: readonly string[]): boolean => isTrusted(models, boundary, ctx.config.hum);
	const kind = ctx.state.itemKinds.get(ctx.id);
	const plan = ctx.state.plans.get(ctx.id);

	return [
		...(kind?.from === "fallback" ? [abstained("kind", kind.why)] : []),
		...(alignment && "abstained" in alignment ? [abstained("alignment", alignment.abstained)] : []),
		...(plan && !measured("plan-outcome", plan.models) ? [abstained("plan-outcome", unmeasured(plan.models))] : []),
		...(verdict && !measured("review-verdict", verdict.models) ? [abstained("review-verdict", unmeasured(verdict.models))] : []),
	];
};
