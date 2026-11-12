import { quantile } from "simple-statistics";
import type { HumConfig, Launch, Level, PathRule } from "../config/schema.ts";

/** What only the owner changes: hum's own config, the owner's adapters and the CI workflows. */
const OWN_PATHS = [".hum/**", "adapters/**", ".github/workflows/**"] as const;

/** What hum reads from a change's diff. */
export type Change = {
	readonly paths: readonly string[];
	/** Lines added plus lines deleted. */
	readonly size: number;
	/** An added or removed line matches the project's loosened-check rule. */
	readonly loosened: boolean;
	/** A changed line in `package.json` or a lockfile names the engine package. */
	readonly pinChanged: boolean;
};

export const LABELS = ["reverted", "fixed", "clean"] as const;

export type Label = (typeof LABELS)[number];

/** A path rule's merged changes on the base, newest first. */
export type PathHistory = {
	readonly sizes: readonly number[];
	readonly labels: readonly Label[];
};

export type Histories = ReadonlyMap<string, PathHistory>;

export type Policy = Pick<
	HumConfig,
	"levels" | "paths" | "strictPaths" | "launches" | "sizeRange" | "hookPaths"
>;

/** When the change is placed, and onto which base: launches depend on both. */
export type Moment = {
	readonly now: number;
	readonly base: string;
	/** The lowest level the change's kind takes. */
	readonly kindFloor?: string;
	/** Globs of paths with a break the owner's level blocks until its follow-up merges. */
	readonly blocked?: readonly string[];
};

/** One reason the level is what it is. */
export type Step =
	| { readonly step: "path"; readonly glob: string; readonly level: string }
	| { readonly step: "launch"; readonly glob: string; readonly level: string }
	| {
			readonly step: "fix-limit";
			readonly glob: string;
			readonly level: string;
			readonly breaks: number;
			readonly limit: number;
		}
	| { readonly step: "data-or-secret"; readonly path: string }
	| { readonly step: "own-config"; readonly path: string }
	| { readonly step: "kind-floor"; readonly level: string }
	| { readonly step: "blocked-path"; readonly path: string }
	| { readonly step: "engine-pin" }
	| {
			readonly step: "size";
			readonly glob: string;
			readonly size: number;
			readonly usual: number;
		}
	| { readonly step: "loosened-check" }
	| { readonly step: "alignment" };

type SetsLevel = Extract<Step, { level: string }>;

export type Placement = {
	readonly level: Level;
	/** Paths no rule places. The change runs at the level of the rest and never merges on its own. */
	readonly unclear: readonly string[];
	readonly steps: readonly Step[];
};

const matches = (glob: string, path: string): boolean =>
	new Bun.Glob(glob).match(path);

const isLaunchOn = (launch: Launch, { now, base }: Moment): boolean =>
	"base" in launch
		? matches(launch.base, base)
		: Date.parse(launch.from) <= now && now < Date.parse(launch.until);

/** Fixed or reverted changes among a path's last `of` merged changes. */
const breaksIn = (labels: readonly Label[], of: number): number =>
	labels.slice(0, of).filter((label) => label !== "clean").length;

/** The top of a path's usual size range, or undefined while it has too few merged changes to have one. */
export const usualSize = (
	sizes: readonly number[],
	{ changes, fewest, middle }: Policy["sizeRange"],
): number | undefined => {
	const recent = sizes.slice(0, changes);
	const upperShare = (1 + middle) / 2;

	return recent.length < fewest ? undefined : quantile([...recent], upperShare);
};

/**
 * A change's risk level: the highest level among the paths it touches, each raised by a launch or by its
 * fix-and-revert limit; the strictest level for data, secrets and hum's own config; then one step up above a
 * path's usual size range and one for a loosened check. A path no rule places marks the change unclear and
 * never raises its level.
 */
export const placeChange = (
	change: Change,
	policy: Policy,
	histories: Histories,
	moment: Moment,
): Placement => {
	const names = policy.levels.map(({ name }) => name);
	const strictest = names.length - 1;
	const rank = (name: string): number => names.indexOf(name);

	const above = (name: string): string =>
		names[Math.min(strictest, rank(name) + 1)] ?? name;

	const rulesOn = (path: string): readonly PathRule[] =>
		policy.paths.filter((rule) => matches(rule.glob, path));

	const isStrict = (path: string): boolean =>
		policy.strictPaths.some((glob) => matches(glob, path));

	const isOwn = (path: string): boolean =>
		[...OWN_PATHS, ...policy.hookPaths].some((glob) => matches(glob, path));

	const touched = [
		...new Map(
			change.paths.flatMap(rulesOn).map((rule) => [rule.glob, rule]),
		).values(),
	];

	const ruleSteps = touched.flatMap((rule): SetsLevel[] => {
		const limit = rule.limit;

		const breaks = limit
			? breaksIn(histories.get(rule.glob)?.labels ?? [], limit.of)
			: 0;

		const isPastLimit = limit !== undefined && breaks > limit.fixes;

		return [
			{ step: "path", glob: rule.glob, level: rule.level },
			...(isPastLimit
				? [
						{
							step: "fix-limit",
							glob: rule.glob,
							level: above(rule.level),
							breaks,
							limit: limit.fixes,
						} as const,
					]
				: []),
		];
	});

	const kindFloorSteps: SetsLevel[] = moment.kindFloor === undefined ? [] : [{ step: "kind-floor", level: moment.kindFloor }];

	const launchSteps = policy.launches.flatMap((launch): SetsLevel[] =>
		isLaunchOn(launch, moment) &&
		change.paths.some((path) => matches(launch.glob, path))
			? [{ step: "launch", glob: launch.glob, level: launch.level }]
			: [],
	);

	const floors: Step[] = [
		...change.paths.flatMap((path): Step[] =>
			isStrict(path) ? [{ step: "data-or-secret", path }] : [],
		),
		...change.paths.flatMap((path): Step[] =>
			isOwn(path) ? [{ step: "own-config", path }] : [],
		),
		...(change.pinChanged ? [{ step: "engine-pin" } as const] : []),
		...change.paths.flatMap((path): Step[] =>
			(moment.blocked ?? []).some((glob) => matches(glob, path)) ? [{ step: "blocked-path", path }] : [],
		),
	];

	const oversized = touched.flatMap((rule): Step[] => {
		const usual = usualSize(
			histories.get(rule.glob)?.sizes ?? [],
			policy.sizeRange,
		);

		return usual !== undefined && change.size > usual
			? [{ step: "size", glob: rule.glob, size: change.size, usual }]
			: [];
	});

	const bumps: Step[] = [
		...oversized.slice(0, 1),
		...(change.loosened ? [{ step: "loosened-check" } as const] : []),
	];

	const highest = Math.max(
		0,
		...[...ruleSteps, ...launchSteps, ...kindFloorSteps].map(({ level }) => rank(level)),
	);

	const floored = floors.length > 0 ? strictest : highest;
	const level = policy.levels[Math.min(strictest, floored + bumps.length)];

	if (!level) throw new Error("a config has at least one level");

	return {
		level,
		unclear: change.paths.filter(
			(path) => rulesOn(path).length === 0 && !isStrict(path) && !isOwn(path),
		),
		steps: [...ruleSteps, ...launchSteps, ...kindFloorSteps, ...floors, ...bumps],
	};
};
