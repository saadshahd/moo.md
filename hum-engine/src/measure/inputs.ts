import type { State } from "../state/open.ts";
import type { Counted } from "./measure.ts";

/** The prefix of the op key every question to the owner is written under. */
const QUESTION_OP = "question:";

/** Spent records of work outside any item carry this prefix. */
export const LOOP_SPEND_PREFIX = "loop:";

/** Reads what each item cost from what the engine saved: notes, question events and the item's token total. */
export const measureInputsOf = (state: State) => {
	const merges = state.merges.list();
	const notes = state.notes.list();
	const spent = state.spent.list();
	const asked = state.ops.list().filter(({ op, state: done }) => op.startsWith(QUESTION_OP) && done === "done");

	const costOf = (item: string, shas: readonly string[]): Counted => ({
		notes: notes.filter((note) => note.item === item || shas.includes(note.change)).length,
		questions: asked.filter((found) => found.itemId === item).length,
		tokens: spent.find((found) => found.item === item)?.total ?? 0,
	});

	return {
		merged: merges.map(({ item, sha, at, paths }) => ({ item, at, paths, ...costOf(item, [sha]) })),
		abandoned: state.parked.list().flatMap(({ item, why, since }) => (why === "stuck" && !merges.some((merge) => merge.item === item) ? [{ item, since, paths: [], ...costOf(item, []) }] : [])),
		loopTokens: spent.filter(({ item }) => item.startsWith(LOOP_SPEND_PREFIX)).reduce((total, { total: tokens }) => total + tokens, 0),
	};
};
