import type { PastChange } from "../decide/labels.ts";
import { breakOf, type LabelRules } from "../decide/labels.ts";
import { optionOf, type SettledAnswer } from "../state/saved.ts";
import type { State } from "../state/open.ts";
import { type NoteSource, noteKey, type ReviewNote } from "./records.ts";

/** What an integration reads from the review surface, before the owner's own are told from the rest. */
export type RawComment = {
	readonly kind: "comment" | "review";
	readonly id: string;
	readonly author: string;
	readonly isBot: boolean;
	readonly body: string;
	/** The commit the comment sits on. */
	readonly commit: string;
	readonly file?: string;
	readonly line?: number;
	readonly hunk?: string;
	readonly at: number;
};

const SOURCE_OF_KIND: Readonly<Record<RawComment["kind"], NoteSource>> = { comment: "review-comment", review: "review-body" };

/** The owner's comments and review bodies; a bot's, another person's and an empty body are not review notes. */
export const ownerNotes = (raw: readonly RawComment[], owners: readonly string[]): ReviewNote[] =>
	raw.flatMap((found): ReviewNote[] =>
		owners.includes(found.author) && !found.isBot && found.body.trim() !== ""
			? [{ source: SOURCE_OF_KIND[found.kind], sourceId: found.id, change: found.commit, file: found.file, line: found.line, hunk: found.hunk ?? "", text: found.body.trim(), at: found.at }]
			: [],
	);

/** The option that approves a plan; every other answer changed it. */
export const APPROVAL_OPTION = "approve";

/** An answer that changed the plan: one applied, and not an approval. */
export const planChangingNotes = (answers: readonly SettledAnswer[]): ReviewNote[] =>
	answers
		.flatMap((answer): ReviewNote[] =>
		answer.disposition === "applied" && optionOf(answer) !== APPROVAL_OPTION ? [{ source: "plan-answer", sourceId: `${answer.item}:${answer.ordinal}`, change: answer.item, item: answer.item, hunk: "", text: answer.text, at: answer.at }] : [],
	);

/** The revert or fix commit behind each broken change, with the hunk it made. */
export const breakNotes = (changes: readonly PastChange[], rules: LabelRules, hunkOf: (sha: string, file: string | undefined) => Promise<string>): Promise<ReviewNote[]> =>
	Promise.all(
		changes.flatMap((change, at) => {
			const found = breakOf(changes, at, rules);

			if (!found) return [];

			const file = found.by.files.find((path) => change.files.includes(path));

			return [
				hunkOf(found.by.sha, file).then(
					(hunk): ReviewNote => ({
						source: found.label === "reverted" ? "revert" : "fix",
						sourceId: found.by.sha,
						change: change.sha,
						file,
						hunk,
						text: `${found.by.subject}\n${found.by.body}`.trim(),
						at: found.by.committedAt ?? at,
					}),
				),
			];
		}),
	);

/** Saves each note once, keyed by its source and source id; the ones this call added are returned. */
export const saveNotes = (state: State, notes: readonly ReviewNote[]): ReviewNote[] =>
	notes.filter((note) => {
		if (state.notes.get(noteKey(note))) return false;

		state.notes.put(noteKey(note), note);

		return true;
	});
