import diff, { type Difference } from "microdiff";
import * as semver from "semver";
import type { Surface } from "./surface.ts";

const LEVELS = ["none", "patch", "minor", "major"] as const;

export type Level = (typeof LEVELS)[number];

const rank = (level: Level): number => LEVELS.indexOf(level);

const strongest = (levels: readonly Level[]): Level => levels.reduce((top, level) => (rank(level) > rank(top) ? level : top), "none");

/**
 * The keys under which a new entry only adds. Anywhere else a new entry narrows what was accepted (a length,
 * a pattern, a required key) or changes what a name is, and counts as taking behaviour away.
 */
const ADDITIVE_CONTAINERS: ReadonlySet<string | number> = new Set(["properties", "$defs", "defaults", "entryPoints", "commands", "options", "enum", "anyOf"]);

const SOURCE_FILE = /\.ts$/;

const OPTIONAL_ARGUMENT = "[";

const isAddition = ({ path, value }: Extract<Difference, { type: "CREATE" }>): boolean => {
	const container = path.at(-2);

	return (
		(container !== undefined && ADDITIVE_CONTAINERS.has(container)) ||
		SOURCE_FILE.test(String(container)) ||
		(container === "arguments" && String(value).startsWith(OPTIONAL_ARGUMENT))
	);
};

const levelOf = (difference: Difference): Level => (difference.type === "CREATE" && isAddition(difference) ? "minor" : "major");

/** Two owner picks meet here: a change that takes behaviour away is major, and hum stays under 1.0 until its first real project runs. Below 1.0 the next field down carries each level. */
const UNSTABLE_MAJOR = 0;

const LEVEL_BELOW_ONE: Record<Level, Level> = { major: "minor", minor: "patch", patch: "patch", none: "none" };

const levelAt = (version: string, level: Level): Level => (semver.major(version) === UNSTABLE_MAJOR ? LEVEL_BELOW_ONE[level] : level);

/** The version that only reserves the package name and never published a surface. */
export const PLACEHOLDER_VERSION = "0.0.0";

/** One difference between two surfaces, with the smallest bump that may carry it. */
export type Finding = { readonly part: string; readonly path: string; readonly difference: Difference["type"]; readonly requires: Level };

export const findingsBetween = (published: Surface, next: Surface, version: string): Finding[] =>
	diff(published, next).map((difference) => ({
		part: String(difference.path[0]),
		path: difference.path.slice(1).join("."),
		difference: difference.type,
		requires: levelAt(version, levelOf(difference)),
	}));

export type Verdict = { readonly ok: true; readonly summary: string } | { readonly ok: false; readonly reasons: readonly string[] };

export type Baseline = { readonly version: string; readonly surface: Surface | undefined };

const refuse = (...reasons: string[]): Verdict => ({ ok: false, reasons });

const DIFFERENCE_WORD: Record<Difference["type"], string> = { CREATE: "added", REMOVE: "removed", CHANGE: "changed" };

const describeFinding = ({ part, path, difference, requires }: Finding): string => `${part} ${path}: ${DIFFERENCE_WORD[difference]}, needs a ${requires} bump`;

/** Whether `next` is a big enough bump over the baseline for the surface it carries. */
export const checkBump = (baseline: Baseline | undefined, next: { readonly version: string; readonly surface: Surface }): Verdict => {
	if (semver.prerelease(next.version)) return refuse(`${next.version} is a prerelease; releases publish plain versions`);

	if (baseline === undefined) return { ok: true, summary: "nothing is published yet, so there is no surface to compare" };

	if (!semver.gt(next.version, baseline.version)) return refuse(`${next.version} is not above the published ${baseline.version}`);

	if (baseline.surface === undefined) {
		return baseline.version === PLACEHOLDER_VERSION
			? { ok: true, summary: `the published ${baseline.version} only reserves the name, so there is no surface to compare` }
			: refuse(`the published ${baseline.version} carries no surface to compare against`);
	}

	const findings = findingsBetween(baseline.surface, next.surface, baseline.version);
	const required = strongest(findings.map(({ requires }) => requires));
	// SAFETY: `gt` above makes the versions differ, and prereleases were refused, so `diff` names a level.
	const bumped = semver.diff(baseline.version, next.version) as Level;

	return rank(bumped) >= rank(required)
		? { ok: true, summary: `${baseline.version} to ${next.version} is a ${bumped} bump; the change needs ${required === "none" ? "no bump" : required}` }
		: refuse(
				`${baseline.version} to ${next.version} is a ${bumped} bump; the change needs ${required}`,
				...findings.filter(({ requires }) => rank(requires) > rank(bumped)).map(describeFinding),
			);
};
