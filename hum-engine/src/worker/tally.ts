import type { State } from "../state/open.ts";
import type { Spent } from "../state/saved.ts";

/** An item's token count, read and written through the saved record on every call, so every run of the item adds to the one total. */
export const tallyOf = (state: State, item: string) => {
	const read = (): Spent => state.spent.get(item) ?? { item, total: 0, base: 0 };

	return {
		/** Tokens spent since the owner last answered, which is what the kind's cap counts. */
		sinceAnswer: (): number => read().total - read().base,
		spend: (tokens: number): void => {
			const now = read();

			state.spent.put(item, { ...now, total: now.total + tokens });
		},
		/** The owner answered: the cap counts from here. */
		startAfresh: (): void => {
			const now = read();

			state.spent.put(item, { ...now, base: now.total });
		},
	};
};
