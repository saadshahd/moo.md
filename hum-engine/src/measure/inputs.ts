import type { Label } from "../decide/risk.ts";
import { brokenCommits } from "../loop/breaks.ts";
import { BREAK_NOTES, commitsOf, type Merge, type NoteSource } from "../loop/records.ts";
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
	const broken = brokenCommits(state);

	const costOf = (item: string, shas: readonly string[]): Counted => ({
		notes: notes.filter((note) => note.item === item || shas.includes(note.change)).length,
		questions: asked.filter((found) => found.itemId === item).length,
		tokens: spent.find((found) => found.item === item)?.total ?? 0,
	});

	const isNamedBy = (source: NoteSource, commits: readonly string[]): boolean => notes.some((note) => note.source === source && commits.includes(note.change));

	/** A merged change's label, as `labelChanges` gives it from git, read from what the loop saved: a revert note on one of its commits, else a fix note on one or a test of the base that failed after it, else clean. */
	const labelOf = (merge: Merge): Label => {
		const commits = commitsOf(merge);

		if (isNamedBy(BREAK_NOTES.reverted, commits)) return "reverted";

		return isNamedBy(BREAK_NOTES.fixed, commits) || broken.has(merge.sha) ? "fixed" : "clean";
	};

	return {
		merged: merges.map((merge) => ({ item: merge.item, at: merge.at, paths: merge.paths, doneBy: merge.doneBy, label: labelOf(merge), ...costOf(merge.item, commitsOf(merge)) })),
		abandoned: state.parked.list().flatMap(({ item, why, since }) => (why === "stuck" && !merges.some((merge) => merge.item === item) ? [{ item, since, paths: [], ...costOf(item, []) }] : [])),
		loopTokens: spent.filter(({ item }) => item.startsWith(LOOP_SPEND_PREFIX)).reduce((total, { total: tokens }) => total + tokens, 0),
	};
};
