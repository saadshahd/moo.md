import { NOTE_KIND, type ThreadEntry } from "../adapter-api.ts";
import { isWaitingOnOwner, nextStates, reachedFrom } from "../config/machine.ts";
import type { HumConfig, Kind, PURPOSES } from "../config/schema.ts";

/** A pick role's row runs only for a choice a shape run named, never as a step's own run, so no step that invokes it reads a note. */
const NOTELESS_PURPOSES: ReadonlySet<(typeof PURPOSES)[number]> = new Set(["pick"]);

/** Where an item stands for a note: the step it goes on from, whether that step's run has launched there, and whether it is parked. */
export type NoteFrom = { readonly from: string; readonly launched: boolean; readonly parked: boolean };

/** How an item goes on: a pass runs on it now, a change it saved for landing lands with no run, or it is parked until the owner acts on its card. */
export type Going = { readonly running: boolean; readonly landing: boolean; readonly parked: boolean };

/**
 * Where an item at `at` goes on from: that step while a pass runs on it, or while its saved change lands, its run
 * launched; between passes the owner's wait it is saved at, else its kind's first step, where the next pass restarts it,
 * whose run has yet to launch.
 */
export const noteFrom = (kind: Kind, at: string | undefined, { running, landing, parked }: Going): NoteFrom => {
	const restart = { from: kind.machine.initial, launched: false, parked };

	if (at === undefined) return restart;

	if (running || landing) return { from: at, launched: true, parked };

	return isWaitingOnOwner(kind, at) ? { from: at, launched: false, parked } : restart;
};

/**
 * The steps of a kind a note may go to from where an item stands: each step whose run reads a prompt hum builds, that the
 * item reaches through every transition from the steps after the one it goes on from. That step itself counts where a
 * loop leads back to it, or where its run has yet to launch. A parked item reaches none until the owner acts on its card.
 */
export const noteReach = (kind: Kind, roles: HumConfig["roles"]): ((at: NoteFrom) => ReadonlySet<string>) => {
	const next = nextStates(kind);
	const { states } = kind.machine;

	const takesNote = (state: string): boolean => {
		const source = states[state]?.invoke?.src;
		const role = source === undefined ? undefined : roles[source];

		return role !== undefined && !NOTELESS_PURPOSES.has(role.purpose);
	};

	return ({ from, launched, parked }) => {
		if (parked) return new Set();

		const ahead = (next.get(from) ?? []).flatMap((after) => [...reachedFrom(after, next)]);

		return new Set([...(launched ? [] : [from]), ...ahead].filter(takesNote));
	};
};

/** Why a note to `step` reaches no run from the step the item is at. */
export const unreachableNote = (step: string, at: string): string => `no run of ${step} lies ahead of the item at ${at}`;

/** What became of a note: kept for its step's next run, refused, delivered to that run, or dropped once the item can no longer reach it. */
export const NOTE_DISPOSITIONS = ["kept", "refused", "delivered", "dropped"] as const;

export type NoteOutcome = { readonly disposition: (typeof NOTE_DISPOSITIONS)[number]; readonly why: string };

/** One note on an item's thread, with its number among the thread's notes. */
export type ThreadNote = { readonly ordinal: number; readonly entry: ThreadEntry };

/** Every note on the thread, numbered in the order the owner sent them. */
export const notesOn = (thread: readonly ThreadEntry[]): ThreadNote[] => {
	const notes: ThreadNote[] = [];

	for (const entry of thread) if (entry.kind === NOTE_KIND) notes.push({ ordinal: notes.length + 1, entry });

	return notes;
};

/** Where an item stands for the notes on its thread: the step it is at, the steps a note may reach from there, and whether it is parked. */
export type NoteStand = { readonly at: string; readonly reach: ReadonlySet<string>; readonly parked: boolean };

const refused = (why: string): NoteOutcome => ({ disposition: "refused", why });

/** What becomes of a note no saved record settles yet: hum keeps one whose step the item can still reach, for that step's next run. */
export const decideNote = ({ entry: { step } }: ThreadNote, { at, reach, parked }: NoteStand): NoteOutcome => {
	if (step === undefined) return refused("it names no step");

	if (parked) return refused("the item is parked: act on its card first");

	if (!reach.has(step)) return refused(unreachableNote(step, at));

	return { disposition: "kept", why: `hum gives it to the next run of ${step}` };
};

/** A kept note whose step the item can no longer reach is dropped; a parked item keeps its notes, since the owner may release it. */
export const droppedNote = (step: string | undefined, { at, reach, parked }: NoteStand): NoteOutcome | undefined =>
	parked || (step !== undefined && reach.has(step)) ? undefined : { disposition: "dropped", why: `the item passed ${step ?? "its step"} with no way back from ${at}` };

/** A kept note of an item that ended. */
export const ENDED_NOTE: NoteOutcome = { disposition: "dropped", why: "the item ended" };

/** A kept note once a run of its step launched with it. */
export const deliveredNote = (step: string): NoteOutcome => ({ disposition: "delivered", why: `it reached the run of ${step}` });

/** The stem a note's reply opens with, which finds it again on the thread. */
export const noteReplyStem = (ordinal: number, { disposition }: Pick<NoteOutcome, "disposition">): string => `Note ${ordinal} ${disposition}:`;

/** The reply posted on the thread for what became of a note. */
export const noteReplyText = (ordinal: number, outcome: NoteOutcome): string => `${noteReplyStem(ordinal, outcome)} ${outcome.why}.`;

/** What a run reads of the notes the owner sent its step, oldest first. */
export const notesSection = (step: string, texts: readonly string[]): string =>
	texts.length === 0 ? "" : [`## The owner's notes to ${step}`, "The owner sent these to this step, oldest first.", ...texts.map((text) => text.trim())].join("\n\n");
