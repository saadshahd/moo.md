import type { HumConfig } from "../config/schema.ts";
import type { Label } from "./risk.ts";

/** A merged change as git records it on the base. */
export type PastChange = {
	readonly sha: string;
	readonly subject: string;
	/** When the change landed on the base, in ms. */
	readonly committedAt?: number;
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
	(later.subject.includes(`"${earlier.subject}"`) ||
		names(later, earlier) ||
		later.blamed.includes(earlier.sha));

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

/** The later change that breaks `changes[at]`, and how: a revert of it, else a fix among the next `fixWindow` changes on its files. */
export const breakOf = (
	changes: readonly PastChange[],
	at: number,
	rules: LabelRules,
): { readonly by: PastChange; readonly label: Exclude<Label, "clean"> } | undefined => {
	const change = changes[at];

	if (!change) return undefined;

	const later = changes.slice(at + 1);
	const reverting = later.find((next) => isRevertOf(next, change, rules));

	if (reverting) return { by: reverting, label: "reverted" };

	const fixing = later
		.filter((next) => sharesAFile(next, change))
		.slice(0, rules.fixWindow)
		.find((next) => isFixOf(next, change, rules));

	return fixing ? { by: fixing, label: "fixed" } : undefined;
};

/**
 * Each change's label: reverted or fixed by `breakOf`, fixed when it is in `broken` (a test of the base failed after
 * it merged), clean otherwise. `changes` runs oldest first.
 */
export const labelChanges = (
	changes: readonly PastChange[],
	rules: LabelRules,
	broken: ReadonlySet<string> = new Set(),
): ReadonlyMap<string, Label> =>
	new Map(
		changes.map((change, at): [string, Label] => [
			change.sha,
			breakOf(changes, at, rules)?.label ?? (broken.has(change.sha) ? "fixed" : "clean"),
		]),
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
