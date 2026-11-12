/** What an item cost the owner: review notes, questions, and model tokens. */
export type Counted = { readonly notes: number; readonly questions: number; readonly tokens: number };

export type MergedChange = Counted & { readonly item: string; readonly at: number; readonly paths: readonly string[] };

/** An item that never merged. Its cost counts all the same, so dropping work never lowers a number. */
export type AbandonedItem = Counted & { readonly item: string; readonly since: number; readonly paths: readonly string[] };

type PerMerge = { readonly merges: number; readonly abandoned: number; readonly notes: number; readonly questions: number; readonly tokens: number };

export type MeasureInput = {
	readonly merged: readonly MergedChange[];
	readonly abandoned: readonly AbandonedItem[];
	/** Tokens spent outside any item, such as comparing review notes. */
	readonly loopTokens: number;
	readonly window: number;
	/** Path globs that each get their own numbers over their own last `window` merged changes. */
	readonly globs: readonly string[];
};

export type Measured = PerMerge & {
	readonly window: number;
	readonly byPath: ({ readonly glob: string } & PerMerge)[];
};

const sum = (counted: readonly Counted[], key: keyof Counted): number => counted.reduce((total, found) => total + found[key], 0);

const perMerge = (merged: readonly MergedChange[], abandoned: readonly AbandonedItem[], loopTokens: number): PerMerge => {
	const all = [...merged, ...abandoned];
	const merges = merged.length;

	return {
		merges,
		abandoned: abandoned.length,
		notes: sum(all, "notes") / merges,
		questions: sum(all, "questions") / merges,
		tokens: (sum(all, "tokens") + loopTokens) / merges,
	};
};

const newestFirst = (merged: readonly MergedChange[], window: number): MergedChange[] => merged.toSorted((a, b) => b.at - a.at).slice(0, window);

/** The abandoned items from the oldest merge in the window on. */
const abandonedSince = (abandoned: readonly AbandonedItem[], inWindow: readonly MergedChange[]): AbandonedItem[] => {
	const start = Math.min(...inWindow.map(({ at }) => at));

	return abandoned.filter(({ since }) => since >= start);
};

const touches = (glob: string, paths: readonly string[]): boolean => paths.some((path) => new Bun.Glob(glob).match(path));

/**
 * The three numbers per merged change over the last `window` merged changes, and over each path's own last
 * `window`. `undefined` while nothing has merged, when a per-merge number has no meaning.
 */
export const measureOf = ({ merged, abandoned, loopTokens, window, globs }: MeasureInput): Measured | undefined => {
	const recent = newestFirst(merged, window);

	if (recent.length === 0) return undefined;

	const byPath = globs.flatMap((glob) => {
		const onPath = newestFirst(merged.filter(({ paths }) => touches(glob, paths)), window);

		return onPath.length === 0 ? [] : [{ glob, ...perMerge(onPath, abandonedSince(abandoned, onPath).filter(({ paths }) => touches(glob, paths)), 0) }];
	});

	return { window, ...perMerge(recent, abandonedSince(abandoned, recent), loopTokens), byPath };
};
