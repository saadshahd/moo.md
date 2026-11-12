import { createHash } from "node:crypto";
import type { WorkSource } from "../adapter-api.ts";
import type { State } from "../state/open.ts";
import { noteKey, type RepeatGroup, type ReviewNote } from "./records.ts";

const SHORT_HASH = 10;
const TITLE_CELLS = 60;

const hashOf = (groupKey: string): string => createHash("sha1").update(groupKey).digest("hex").slice(0, SHORT_HASH);

/** The name the check item is told to give its check, so CI's log can name it. */
export const checkNameOf = (groupKey: string): string => `hum-check-${hashOf(groupKey)}`;

/** The id a group files its items from; filing the same title from it twice returns the first item. */
export const filedFrom = (groupKey: string): string => `rn-${hashOf(groupKey)}`;

const oneLine = (text: string): string => text.replace(/\s+/g, " ").trim();

const where = ({ file, line }: ReviewNote): string => (file === undefined ? "" : ` on ${file}${line === undefined ? "" : `:${line}`}`);

const quoted = (text: string): string => text.split("\n").map((line) => `> ${line}`).join("\n");

const noteBlock = (note: ReviewNote): string =>
	[`- ${note.source} ${note.sourceId}${where(note)}, change ${note.change}`, quoted(note.text), ...(note.hunk === "" ? [] : ["", "```diff", note.hunk.trimEnd(), "```"])].join("\n");

const titleOf = (note: ReviewNote): string => `Check: ${oneLine(note.text).slice(0, TITLE_CELLS)}`;

/** The check item for a group: the kind, the name its check takes, and every note with its link and hunk. */
const checkItemOf = (first: ReviewNote, notes: readonly ReviewNote[], checkKind: string, checkName: string) => ({
	title: titleOf(first),
	body: [
		`Kind: ${checkKind}`,
		"",
		`The owner made these review notes about one rule. Turn them into one rule with hope:anchor, widen it where the notes show a wider class, and add the cheapest check that decides it: a type, then a rule the repo's linter has, then a custom lint rule, then a test. Name the check \`${checkName}\`. It must fail on each note's commit and pass on the base.`,
		"",
		notes.map(noteBlock).join("\n\n"),
	].join("\n"),
});

export type FilingOptions = {
	readonly state: State;
	readonly workSource: Pick<WorkSource, "fileFollowUp" | "comment">;
	/** Notes stating one rule at which a check item is filed. */
	readonly repeatAt: number;
	readonly checkKind: string;
};

const notesOf = (state: State, group: RepeatGroup): ReviewNote[] =>
	group.notes.flatMap((key) => state.notes.get(key) ?? []).toSorted((a, b) => a.at - b.at);

/**
 * Files one check item for each group that reached `repeatAt` notes and has none, and adds every later note to its
 * item's thread. The item's id comes from the group, so a rerun files nothing.
 */
export const fileChecks = async ({ state, workSource, repeatAt, checkKind }: FilingOptions): Promise<void> => {
	for (const group of state.repeats.list()) {
		const notes = notesOf(state, group);

		const [first] = notes;

		if (first === undefined || notes.length < repeatAt) continue;

		if (group.item === undefined) {
			const filed = await workSource.fileFollowUp(filedFrom(group.key), checkItemOf(first, notes, checkKind, checkNameOf(group.key)));

			state.repeats.put(group.key, { ...group, item: filed.id, commented: group.notes });
			continue;
		}

		const unposted = notes.filter((found) => !group.commented.includes(noteKey(found)));

		for (const note of unposted) await workSource.comment(group.item, noteBlock(note));

		if (unposted.length > 0) state.repeats.put(group.key, { ...group, commented: group.notes });
	}
};
