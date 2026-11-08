import { proofFor } from "../config/checks.ts";
import type { HumConfig, Level } from "../config/schema.ts";
import type { Placement } from "./risk.ts";

/** What a placed change needs before it merges and before it ships. */
export type Route = {
	readonly level: Level;
	readonly unclear: boolean;
	/** Nothing waits on a review: the level asks for none and no path is unclear. */
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

/** Merge by level: low merges on green, medium waits for a fresh agent review, high and critical for the owner's; an unclear change never merges on its own. */
export const routeOf = (
	{ level, unclear }: Placement,
	paths: HumConfig["paths"],
	kind: string,
	touched: readonly string[],
): Route => {
	const isUnclear = unclear.length > 0;

	const proofs = paths
		.filter(
			(rule) =>
				rule.level === level.name &&
				touched.some((path) => new Bun.Glob(rule.glob).match(path)),
		)
		.flatMap((rule) => proofFor(rule, kind) ?? []);

	return {
		level,
		unclear: isUnclear,
		mergesAlone: level.review === "none" && !isUnclear,
		proof:
			level.release === "after-proof"
				? proofs.join("; ") || STRICTEST_PROOF
				: undefined,
	};
};

/** A route merges once nothing waits: on its own, or once the owner approved it. */
export const isCleared = (route: Route, ownerApproved: boolean): boolean =>
	route.mergesAlone || ownerApproved;

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

/** Why a change that is not cleared waits, in words for its card and its pull request. */
export const waitReason = (route: Route): string => {
	if (route.unclear) return "a changed path matches no path rule";

	return route.level.review === "agent" ? `level ${route.level.name} waits for a fresh review run` : `level ${route.level.name} waits for your review`;
};
