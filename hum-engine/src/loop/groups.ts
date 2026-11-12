import { createHash } from "node:crypto";
import { extname } from "node:path";
import type { State } from "../state/open.ts";
import { noteKey, type RepeatGroup, type ReviewNote } from "./records.ts";
import { type Pairing, pairing, prepare } from "./signals.ts";

/** A model's answer to whether two notes state one rule; `undefined` when it abstained. */
type Proposal = { readonly same: boolean; readonly models: readonly string[] } | undefined;

export type Proposer = (a: ReviewNote, b: ReviewNote) => Promise<Proposal>;

export type GroupingOptions = {
	readonly state: State;
	/** Row 14's model call: asked only about notes no signal pairs. */
	readonly propose: Proposer;
	/** Whether a model's proposal files a check alone: its precision on labelled pairs reached the owner's bar. */
	readonly trusts: (models: readonly string[]) => boolean;
	/** Told when a note's language left a signal unapplied, so it is never silent. */
	readonly onUnapplied: (extension: string, signals: readonly string[]) => void;
};

const noteOf = (state: State, key: string): ReviewNote => {
	const note = state.notes.get(key);

	if (!note) throw new Error(`group member ${key} has no saved note`);

	return note;
};

/** The first group a deterministic signal puts the note in, with every group it pairs with. */
const pairedGroups = (state: State, note: ReviewNote, groups: readonly RepeatGroup[], onUnapplied: GroupingOptions["onUnapplied"]): RepeatGroup[] => {
	const target = prepare(note);

	const report = ({ unapplied }: Pairing): void => {
		if (unapplied.length > 0) onUnapplied(extname(note.file ?? "") || "(none)", unapplied);
	};

	return groups.filter((group) =>
		group.notes.some((key) => {
			const found = pairing(prepare(noteOf(state, key)), target);

			report(found);

			return found.signal !== undefined;
		}),
	);
};

const byAge = (state: State) => (a: RepeatGroup, b: RepeatGroup): number => noteOf(state, a.key).at - noteOf(state, b.key).at || (a.key < b.key ? -1 : 1);

const join = (state: State, group: RepeatGroup, key: string): RepeatGroup => {
	const joined = { ...group, notes: group.notes.includes(key) ? group.notes : [...group.notes, key] };

	state.repeats.put(group.key, joined);

	return joined;
};

const isFiled = (group: RepeatGroup): boolean => group.item !== undefined;

/**
 * Joins the groups the note pairs with into one: the oldest with a filed check item, else the oldest. Only groups
 * with no item merge into it; a group whose item is filed stays whole, so no filed item loses the group it proves.
 */
const mergeInto = (state: State, groups: readonly RepeatGroup[], key: string): void => {
	const oldestFirst = groups.toSorted(byAge(state));
	const target = oldestFirst.find(isFiled) ?? oldestFirst[0];

	if (!target) return;

	const absorbed = oldestFirst.filter((group) => group !== target && !isFiled(group));
	const merged = { ...target, notes: [...new Set([target, ...absorbed].flatMap(({ notes }) => notes))] };

	for (const other of absorbed) state.repeats.remove(other.key);

	join(state, merged, key);
};

const keyOfPair = (a: string, b: string): string => createHash("sha1").update([a, b].sort().join("|")).digest("hex").slice(0, 16);

/**
 * Puts each new note in the group whose notes it repeats. Signals decide first, in order. A note no signal pairs
 * goes to the model with one note of each group; a pair it calls alike joins the group only once the model is trusted,
 * and waits as a possible repeat before that. A note with no group starts its own.
 */
export const groupNotes = async ({ state, propose, trusts, onUnapplied }: GroupingOptions, fresh: readonly ReviewNote[]): Promise<void> => {
	for (const note of fresh.toSorted((a, b) => a.at - b.at)) {
		const key = noteKey(note);
		const groups = state.repeats.list();
		const found = pairedGroups(state, note, groups, onUnapplied);

		if (found.length > 0) {
			mergeInto(state, found, key);
			continue;
		}

		let placed = false;

		for (const group of groups.toSorted(byAge(state))) {
			const proposal = await propose(noteOf(state, group.key), note);

			if (proposal?.same !== true) continue;

			if (trusts(proposal.models)) {
				join(state, group, key);
				placed = true;
				break;
			}

			state.possibleRepeats.put(keyOfPair(group.key, key), { a: group.key, b: key, models: [...proposal.models], at: note.at });
		}

		if (!placed) state.repeats.put(key, { key, notes: [key], commented: [], misses: [] });
	}
};
