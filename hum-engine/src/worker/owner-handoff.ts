import type { HandoffRequest, HandoffReview, OwnerHandoff } from "../adapter-api.ts";
import { type Finished, hasSucceeded } from "../adapters/claude-p.ts";
import type { Config } from "../config/load.ts";
import { STAGE_ACTIONS } from "../decide/answer.ts";
import { EventPick, readPick, REQUEST_CHANGES } from "../decide/prose.ts";
import type { State } from "../state/open.ts";
import { type RunKey, runLabel, runName } from "../state/runs.ts";
import type { Landing, Review } from "../state/saved.ts";
import { runBranch } from "./thin-path.ts";

/** Where a review is kept: by its run's name, else, as for a review at landing, by when it answered. */
const reviewKey = ({ item, run, at }: Pick<Review, "item" | "run" | "at">): string => run?.name ?? `${item}@${at}`;

/** The item's reviews, oldest first. */
export const reviewsOf = (state: State, item: string): Review[] => state.reviews.list().filter((review) => review.item === item).toSorted((one, other) => one.at - other.at);

/** Drops the item's reviews, as once its change merged or it starts over. */
export const dropReviews = (state: State, item: string): void => {
	for (const review of reviewsOf(state, item)) state.reviews.remove(reviewKey(review));
};

/**
 * Keeps a review run's answer on the change at `head` among the item's reviews, whether or not hum takes it: one that
 * fails its check is kept with why hum set it aside, since the owner sees it nowhere else. A run that ended without a
 * pick keeps nothing.
 */
export const keepReview = (state: State, { item, head, diff, run, outcome, at }: { readonly item: string; readonly head: string; readonly diff: string; readonly run?: RunKey; readonly outcome: Finished; readonly at: number }): void => {
	const answered = hasSucceeded(outcome) ? EventPick.safeParse(outcome.structured).data : undefined;

	if (answered === undefined) return;

	const read = readPick("review", outcome, diff);
	const { event, reason, cites, plan } = read.ok ? read.pick : answered;
	const review = { item, head, at, run: run && { name: runName(run), label: runLabel(run) }, event, reason, cites, plan, refused: read.ok ? undefined : read.why };

	state.reviews.put(reviewKey(review), review);
};

/** The files a review asks to change: those its plan names, else those it cites. */
const askedFiles = ({ plan, cites }: Review): string[] => (plan && plan.paths.length > 0 ? [...plan.paths] : [...new Set(cites.map(({ file }) => file))]);

/**
 * The changes a review asked for, by what git shows of the change since: open where none of its files changed after
 * the review's head, unclear where one did or hum keeps no record of what changed. A later review's approval settles
 * nothing here, since a model's word is not what the change holds.
 */
const requestOf = (review: Review, landing: Landing | undefined): HandoffRequest | undefined => {
	if (review.event !== REQUEST_CHANGES) return undefined;

	const files = askedFiles(review);
	const text = review.plan?.summary ?? review.reason;
	const since = review.head === landing?.head ? [] : landing?.changedSince?.[review.head];

	if (since === undefined) return { status: "unclear", text, files };

	const changed = files.filter((file) => since.includes(file));

	if (changed.length > 0) return { status: "unclear", text, files, changed };

	const held = landing?.files && new Set(landing.files.map(({ path }) => path));

	return { status: "open", text, files, untouched: held ? files.filter((file) => !held.has(file)) : [] };
};

/** What a review at landing goes by: it runs as no row. */
const LANDING_REVIEW = "review at landing";

/** The purposes of the runs whose rows a handoff links: those that built, fixed and reviewed the change. */
const ROW_PURPOSES: ReadonlySet<string> = new Set(["build", "fix", "review"]);

/** What both handoffs tell of the item's change: its branch, its files and its reviews. */
const changeFacts = (state: State, item: string, branch: string) => {
	const landing = state.landings.get(item);

	return {
		branch: landing?.branch ?? branch,
		files: landing?.files,
		reviews: reviewsOf(state, item).map((review): HandoffReview => ({ label: review.run?.label ?? LANDING_REVIEW, row: review.run?.name, event: review.event, refused: review.refused, request: requestOf(review, landing) })),
	};
};

/**
 * The handoff a question about an item carries while its change waits on the owner, as one with a saved landing or
 * parked for review does; none for any other item. A question with no options takes the owner's own words, and their
 * approve approves.
 */
export const waitingHandoff = (state: State, config: Config, item: string, options: readonly string[] = []): OwnerHandoff | undefined => {
	if (state.landings.get(item) === undefined && state.parked.get(item)?.why !== "review") return undefined;

	return {
		...changeFacts(state, item, runBranch(config.hum, item)),
		rows: state.runs.list(item).flatMap((record) => (ROW_PURPOSES.has(config.hum.roles[record.run]?.purpose ?? "") ? [{ label: runLabel(record), name: record.name }] : [])),
		decide: options.length > 0 ? { options, ownWords: false } : { options: STAGE_ACTIONS.approval, ownWords: true },
	};
};

/** The handoff once the item's change merged at `commit`, read while its landing stands; its rows go with the item, so it links none. */
export const mergedHandoff = (state: State, item: string, commit: string): OwnerHandoff | undefined => {
	const landing = state.landings.get(item);

	return landing && { ...changeFacts(state, item, landing.branch), rows: [], merged: { commit } };
};
