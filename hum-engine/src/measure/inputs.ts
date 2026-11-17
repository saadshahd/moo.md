import type { Label } from "../decide/risk.ts";
import { brokenLabelOf } from "../loop/breaks.ts";
import { commitsOf, type Merge } from "../loop/records.ts";
import { doneByOf, foldItem } from "../state/item-log.ts";
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

	/** A merged change's label: the worst the loop saved for any of its commits, as git's label rule gave it; clean where it saved none. */
	const labelOf = (merge: Merge): Label => brokenLabelOf(state, merge) ?? "clean";

	/** How the item reached done, from its log; unknown where a newer engine wrote some of it, which raises the item's card. */
	const reachedDoneBy = (item: string) => {
		const log = state.events.read(item);

		return log.ok ? doneByOf(foldItem(log.value)) : undefined;
	};

	return {
		merged: merges.map((merge) => ({ item: merge.item, at: merge.at, paths: merge.paths, doneBy: reachedDoneBy(merge.item), label: labelOf(merge), ...costOf(merge.item, commitsOf(merge)) })),
		abandoned: state.parked.list().flatMap(({ item, why, since }) => (why === "stuck" && !merges.some((merge) => merge.item === item) ? [{ item, since, paths: [], ...costOf(item, []) }] : [])),
		loopTokens: spent.filter(({ item }) => item.startsWith(LOOP_SPEND_PREFIX)).reduce((total, { total: tokens }) => total + tokens, 0),
	};
};
