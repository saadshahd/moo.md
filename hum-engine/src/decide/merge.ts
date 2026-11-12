import { proofFor } from "../config/checks.ts";
import type { Boundary, HumConfig, Level, REVIEWS } from "../config/schema.ts";
import type { Placement } from "./risk.ts";

/** Why a change never merges on its own, whatever its level: paths no rule places, or a model call that abstained. */
export type Unclear =
	| { readonly cause: "paths"; readonly paths: readonly string[] }
	| { readonly cause: "abstained"; readonly boundary: Boundary; readonly why: string };

/** What a placed change needs before it merges and before it ships. */
export type Route = {
	readonly level: Level;
	readonly unclear: readonly Unclear[];
	/** Nothing waits on a review: the level asks for none and nothing is unclear. */
	readonly mergesAlone: boolean;
	/** What release waits for once the change merged; undefined when it ships at once. */
	readonly proof: string | undefined;
};

/** How a change reaches its base. */
export type Landing =
	| { readonly via: "push" }
	| { readonly via: "pull-request"; readonly autoMerge: boolean }
	/** Nothing requires a pull request and the change waits for a review: its branch waits, pushed. */
	| { readonly via: "wait" };

const STRICTEST_PROOF = "the owner's word that the change is proven";

/** Who has approved a change: a fresh review run, and the owner. */
export type Approvals = { readonly review: boolean; readonly owner: boolean };

/** What clears a clear change without the owner, by its level's review. The owner's approval clears any change. */
const CLEARED_BY: Readonly<Record<(typeof REVIEWS)[number], (approvals: Approvals) => boolean>> = {
	none: () => true,
	agent: (approvals) => approvals.review,
	owner: () => false,
};

const NO_APPROVALS: Approvals = { review: false, owner: false };

/** Merge by level: low merges on green, medium waits for a fresh agent review, high and critical for that review and the owner's; an unclear change never merges on its own. */
export const routeOf = (
	placement: Placement,
	paths: HumConfig["paths"],
	kind: string,
	touched: readonly string[],
	abstentions: readonly Unclear[] = [],
): Route => {
	const { level } = placement;
	const unclear: Unclear[] = [...(placement.unclear.length > 0 ? [{ cause: "paths", paths: placement.unclear } as const] : []), ...abstentions];

	const proofs = paths
		.filter(
			(rule) =>
				rule.level === level.name &&
				touched.some((path) => new Bun.Glob(rule.glob).match(path)),
		)
		.flatMap((rule) => proofFor(rule, kind) ?? []);

	return {
		level,
		unclear,
		mergesAlone: isCleared({ level, unclear }, NO_APPROVALS),
		proof:
			level.release === "after-proof"
				? proofs.join("; ") || STRICTEST_PROOF
				: undefined,
	};
};

/** A route merges once nothing waits: on its own, once a fresh review approved a clear change at an agent-reviewed level, or once the owner approved it. */
export const isCleared = (route: Pick<Route, "level" | "unclear">, approvals: Approvals): boolean =>
	approvals.owner || (route.unclear.length === 0 && CLEARED_BY[route.level.review](approvals));

/** Every level that asks for a review gets a fresh review run first; the owner's review comes after it. */
export const needsReviewRun = (route: Route): boolean => route.level.review !== "none";

/** Where the target branch requires a pull request, every change lands through one, merging itself only when cleared; elsewhere a cleared change is pushed. */
export const landingOf = (
	requiresPullRequest: boolean,
	cleared: boolean,
): Landing => {
	if (requiresPullRequest) return { via: "pull-request", autoMerge: cleared };

	return cleared ? { via: "push" } : { via: "wait" };
};


/** The answer option by which the owner approves a change that waits for their review. */
export const OWNER_APPROVAL = "approve";

const reasonOf = (unclear: Unclear): string =>
	unclear.cause === "paths" ? "a changed path matches no path rule" : `the ${unclear.boundary} call abstained: ${unclear.why}`;

/** Why a change that is not cleared waits, in words for its card and its pull request. */
export const waitReason = (route: Route): string => {
	const [unclear] = route.unclear;

	if (unclear) return reasonOf(unclear);

	return route.level.review === "agent" ? `level ${route.level.name} waits for a fresh review run` : `level ${route.level.name} waits for your review`;
};
