import type { State } from "../state/open.ts";
import { type Count, NO_COUNT, type Spent } from "../state/saved.ts";

const sinceAnswerOf = ({ total, base }: Count): number => total - base;

const added = <C extends Count>(count: C, more: number): C => ({ ...count, total: count.total + more });

const afresh = <C extends Count>(count: C): C => ({ ...count, base: count.total });

/** An item's token and fix-run counts, read and written through the saved record on every call, so every run of the item adds to the one total. */
export const tallyOf = (state: State, item: string) => {
	const read = (): Spent => state.spent.get(item) ?? { item, ...NO_COUNT, fixes: NO_COUNT };
	const update = (next: (now: Spent) => Spent): void => state.spent.put(item, next(read()));

	return {
		/** Tokens spent since the owner last answered, which is what the kind's cap counts. */
		sinceAnswer: (): number => sinceAnswerOf(read()),
		spend: (tokens: number): void => update((now) => added(now, tokens)),
		/** Fix runs that handed back a change since the owner last answered, which is what `maxFixRuns` counts. */
		fixesSinceAnswer: (): number => sinceAnswerOf(read().fixes),
		spendFix: (): void => update((now) => ({ ...now, fixes: added(now.fixes, 1) })),
		/** The owner answered: both caps count from here. */
		startAfresh: (): void => update((now) => ({ ...afresh(now), fixes: afresh(now.fixes) })),
	};
};
