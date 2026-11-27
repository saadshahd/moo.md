import { ADAPTER_API_VERSION, type Item, type ItemId, type WorkSource } from "../adapter-api.ts";
import { type CallScope, onceCalls } from "../adapters/once.ts";
import type { HumConfig, Kind } from "../config/schema.ts";
import { decideNote, deliveredNote, droppedNote, ENDED_NOTE, type NoteFrom, type NoteOutcome, type NoteStand, noteReach, noteReplyStem, noteReplyText, notesOn, type ThreadNote } from "../decide/note.ts";
import type { State } from "../state/open.ts";
import type { SettledNote } from "../state/saved.ts";
import { hasReplyOn } from "./thread.ts";

/** The scope of every reply to a note, written by the worker or through a pass's outbox alike, so each reply posts once. */
export const NOTE_REPLY_SCOPE: CallScope = { run: "note-reply", attempt: 0 };

/** Where the replies to notes go: a comment on the item's thread. */
export type NoteWrites = { readonly comment: (id: ItemId, text: string) => Promise<void> };

export type NoteContext = { readonly state: Pick<State, "stepNotes">; readonly writes: NoteWrites; readonly now: () => number };

/** Replies written straight to the work source, each once under its op key. */
export const noteWrites = (state: Pick<State, "ops">, workSource: WorkSource): NoteWrites => {
	const once = onceCalls({ apiVersion: ADAPTER_API_VERSION, workSource }, state.ops, NOTE_REPLY_SCOPE).workSource ?? workSource;

	return { comment: (id, text) => once.comment(id, text) };
};

/** Where an item of `kind` stands for its notes as it goes on `from` a step, given the configured roles. */
export const noteStandOf = (kind: Kind, roles: HumConfig["roles"], from: NoteFrom): NoteStand => ({ at: from.from, reach: noteReach(kind, roles)(from), parked: from.parked });

/** The key a note's record is saved under: its item and its number among the thread's notes. */
export const noteKey = (item: string, ordinal: number): string => `${item}#${ordinal}`;

const recordOf = (item: string, { ordinal, entry }: ThreadNote, outcome: NoteOutcome, at: number): SettledNote => ({ item, ordinal, step: entry.step, ...outcome, at });

/**
 * Every note on the item's thread is saved with what became of it, and each outcome gets one reply. A new note is kept
 * or refused; a kept one whose step the item can no longer reach is dropped. A note moves no item.
 */
export const settleNotes = async (ctx: NoteContext, item: Item, stand: NoteStand): Promise<void> => {
	for (const note of notesOn(item.thread)) {
		const key = noteKey(item.id, note.ordinal);
		const saved = ctx.state.stepNotes.get(key);
		const outcome = saved === undefined ? decideNote(note, stand) : saved.disposition === "kept" ? droppedNote(saved.step, stand) : undefined;
		const settled = outcome === undefined ? saved : recordOf(item.id, note, outcome, ctx.now());

		if (settled === undefined) continue;

		if (settled !== saved) ctx.state.stepNotes.put(key, settled);

		if (!hasReplyOn(item.thread, noteReplyStem(note.ordinal, settled))) await ctx.writes.comment(item.id, noteReplyText(note.ordinal, settled));
	}
};

/** A note hum keeps for `step`: its number and the owner's words. */
export type KeptNote = { readonly ordinal: number; readonly text: string };

/** The notes hum keeps for `step`, oldest first, as the item's thread holds them. */
export const keptNotes = (state: Pick<State, "stepNotes">, item: Item, step: string): KeptNote[] =>
	notesOn(item.thread)
		.filter(({ ordinal, entry }) => entry.step === step && state.stepNotes.get(noteKey(item.id, ordinal))?.disposition === "kept")
		.map(({ ordinal, entry }) => ({ ordinal, text: entry.text }));

/** Moves each kept note to a new outcome, saved before its reply; one already moved stays as it is. */
const moveKept = async (ctx: NoteContext, id: ItemId, records: readonly SettledNote[], outcome: (record: SettledNote) => NoteOutcome): Promise<void> => {
	for (const record of records) {
		const key = noteKey(id, record.ordinal);

		if (ctx.state.stepNotes.get(key)?.disposition !== "kept") continue;

		const moved = { ...record, ...outcome(record), at: ctx.now() };

		ctx.state.stepNotes.put(key, moved);
		await ctx.writes.comment(id, noteReplyText(record.ordinal, moved));
	}
};

/** Marks each note numbered in `ordinals` delivered to the run of `step` whose prompt held it, and says so on the thread. */
export const deliverNotes = async (ctx: NoteContext, id: ItemId, step: string, ordinals: readonly number[]): Promise<void> => {
	const records = ordinals.flatMap((ordinal) => ctx.state.stepNotes.get(noteKey(id, ordinal)) ?? []);

	await moveKept(ctx, id, records, () => deliveredNote(step));
};

/** Drops every note hum keeps for an item that ended, and says so on the thread. */
export const endNotes = async (ctx: NoteContext, id: ItemId): Promise<void> =>
	moveKept(
		ctx,
		id,
		ctx.state.stepNotes.list().filter((record) => record.item === id),
		() => ENDED_NOTE,
	);
