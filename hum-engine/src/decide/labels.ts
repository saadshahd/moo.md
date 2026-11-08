import type { HumConfig } from "../config/schema.ts";
import type { Label } from "./risk.ts";

/** A merged change as git records it on the base. */
export type PastChange = {
	readonly sha: string;
	readonly subject: string;
	readonly body: string;
	readonly files: readonly string[];
	/** Lines added plus lines deleted. */
	readonly size: number;
	/** The changes that wrote the lines this one changed or deleted. */
	readonly blamed: readonly string[];
};

export type LabelRules = HumConfig["changeLabels"];

const SHA_IN_TEXT = /\b[0-9a-f]{7,40}\b/g;

const shasIn = (text: string): readonly string[] =>
	text.match(SHA_IN_TEXT) ?? [];

const names = (later: PastChange, earlier: PastChange): boolean =>
	shasIn(`${later.subject}\n${later.body}`).some((sha) =>
		earlier.sha.startsWith(sha),
	);

const sharesAFile = (a: PastChange, b: PastChange): boolean =>
	a.files.some((file) => b.files.includes(file));

const revertsByTrailer = (
	later: PastChange,
	earlier: PastChange,
	{ revertTrailer }: LabelRules,
): boolean =>
	[...later.body.matchAll(new RegExp(revertTrailer, "g"))].some(
		([, sha]) => sha !== undefined && earlier.sha.startsWith(sha),
	);

const revertsByTitle = (
	later: PastChange,
	earlier: PastChange,
	{ revertSubject }: LabelRules,
): boolean =>
	new RegExp(revertSubject).test(later.subject) &&
	later.subject.includes(`"${earlier.subject}"`);

const isRevertOf = (
	later: PastChange,
	earlier: PastChange,
	rules: LabelRules,
): boolean =>
	revertsByTrailer(later, earlier, rules) ||
	revertsByTitle(later, earlier, rules);

const isFixOf = (
	later: PastChange,
	earlier: PastChange,
	{ fixSubject }: LabelRules,
): boolean =>
	new RegExp(fixSubject).test(later.subject) &&
	(names(later, earlier) || later.blamed.includes(earlier.sha));

/**
 * Each change's label: reverted when a later change reverts it; fixed when a fix lands among the next `fixWindow`
 * changes on its files and names it or changes its lines; clean otherwise. `changes` runs oldest first.
 */
export const labelChanges = (
	changes: readonly PastChange[],
	rules: LabelRules,
): ReadonlyMap<string, Label> =>
	new Map(
		changes.map((change, at): [string, Label] => {
			const later = changes.slice(at + 1);

			const window = later
				.filter((next) => sharesAFile(next, change))
				.slice(0, rules.fixWindow);

			if (later.some((next) => isRevertOf(next, change, rules)))
				return [change.sha, "reverted"];

			return [
				change.sha,
				window.some((next) => isFixOf(next, change, rules)) ? "fixed" : "clean",
			];
		}),
	);

const topFolders = (change: PastChange): string =>
	[...new Set(change.files.map((file) => file.split("/")[0]))].sort().join(" ");

/** Each reverted or fixed change, then for each a clean change on the same top folders whose size is nearest; a clean one is picked once. */
export const matchedSample = (
	changes: readonly PastChange[],
	labels: ReadonlyMap<string, Label>,
): readonly PastChange[] => {
	const broken = changes.filter((change) => labels.get(change.sha) !== "clean");
	const picked = new Set<string>();

	const matchFor = (change: PastChange): readonly PastChange[] => {
		const nearest = changes
			.filter(
				(clean) =>
					labels.get(clean.sha) === "clean" &&
					!picked.has(clean.sha) &&
					topFolders(clean) === topFolders(change),
			)
			.toSorted(
				(a, b) =>
					Math.abs(a.size - change.size) - Math.abs(b.size - change.size),
			)[0];

		if (nearest) picked.add(nearest.sha);

		return nearest ? [nearest] : [];
	};

	return [...broken, ...broken.flatMap(matchFor)];
};
