import type { Answering, AnswerOutcome, AnswerSnapshot, BoxWrite, Posting } from "../../types";
import { setup, types } from "../vendor/libs.js";

export type { Answering, AnswerSnapshot, Posting };

/** Enter from the owner's own prompt or from Remote Control; every other origin is someone else's prompt. */
const OWNER_ORIGINS: ReadonlySet<string> = new Set(["composer", "bridge"]);

/** Submitting empties the box with this origin before the submit arrives; it does not end answer mode. */
const SUBMIT_CLEAR = "clear";

export const SAY = {
	draft: "Your prompt holds a draft. Send or clear it, then press again.",
	posting: (label: string) => `Posting to ${label}…`,
	empty: (label: string) => `${label}: nothing written, nothing posted.`,
	posted: (label: string) => `Posted on ${label}'s thread.`,
	failed: (label: string, cause: string) => `${label}: not posted, ${cause}`,
	unconfirmed: (label: string, cause: string) => `${label}: may have posted, ${cause}. Read its thread before you post again.`,
} as const;

const KEEP: BoxWrite = { kind: "keep" };

const setBox = (text: string): BoxWrite => ({ kind: "set", text });

/** Every event starts from a quiet outcome: Enter untouched, the box kept, nothing said. */
const outcome = (patch: Partial<AnswerOutcome>): AnswerOutcome => ({ enter: "untouched", box: KEEP, say: undefined, ...patch });

const isOwners = (origin: string): boolean => OWNER_ORIGINS.has(origin);

const isEmptyBox = (box: string): boolean => box.trim() === "";

const isBare = (answering: Answering, text: string): boolean => answering.isOpen && text.trim() === answering.filled.trim();

const answeringOf = ({ item, label, opener, filled, isOpen, option }: Posting): Answering => ({ item, label, opener, filled, isOpen, option });

/** Answer mode ends: no answer held, and the outcome the event decided. */
const toOff = (patch: Partial<AnswerOutcome>) => ({ target: "off", context: { ...outcome(patch), answering: undefined } }) as const;

/** On while the box still starts with the opener; off once it does not. */
const followBox = (answering: Answering, box: string, say?: string) =>
	box.startsWith(answering.opener) ? ({ target: "on", context: { ...outcome({ say }), answering } } as const) : toOff({ say });

/**
 * Answer mode: while it is on, the owner's Enter posts on the item's thread instead of reaching Claude. Every event
 * has a transition in every state, so no event is ever ignored without a decision.
 */
export const answerMachine = setup({
	schemas: {
		context: types<AnswerOutcome>(),
		events: {
			filled: types<{ readonly answer: Answering; readonly box: string }>(),
			edited: types<{ readonly box: string }>(),
			changed: types<{ readonly origin: string; readonly box: string }>(),
			submitted: types<{ readonly origin: string; readonly text: string }>(),
			posted: types<{ readonly box: string }>(),
			postFailed: types<{ readonly cause: string; readonly box: string }>(),
			/** The post ran past its limit or never reported: the answer may be on the thread. */
			postUnconfirmed: types<{ readonly cause: string; readonly box: string }>(),
			restarted: types<void>(),
		},
	},
	states: {
		off: { schemas: { context: types<{ readonly answering?: undefined }>() } },
		on: { schemas: { context: types<{ readonly answering: Answering }>() } },
		posting: { schemas: { context: types<{ readonly answering: Posting }>() } },
	},
}).createFSM({
	initial: "off",
	context: outcome({}),
	states: {
		off: {
			on: {
				filled: ({ event }) =>
					isEmptyBox(event.box)
						? { target: "on", context: { ...outcome({ box: setBox(event.answer.filled) }), answering: event.answer } }
						: { context: outcome({ say: SAY.draft }) },
				edited: { context: outcome({}) },
				changed: { context: outcome({}) },
				submitted: { context: outcome({ enter: "claude" }) },
				posted: { context: outcome({}) },
				postFailed: { context: outcome({}) },
				postUnconfirmed: { context: outcome({}) },
				restarted: toOff({}),
			},
		},
		on: {
			on: {
				filled: { context: outcome({ say: SAY.draft }) },
				edited: ({ context, event }) => followBox(context.answering, event.box),
				changed: ({ context, event }) => (event.origin === SUBMIT_CLEAR ? { context: outcome({}) } : followBox(context.answering, event.box)),
				submitted: ({ context: { answering }, event }) => {
					if (!isOwners(event.origin)) return { context: outcome({ enter: "claude" }) };

					if (!event.text.startsWith(answering.opener)) return toOff({ enter: "claude" });

					if (isBare(answering, event.text)) return { context: outcome({ enter: "nowhere", say: SAY.empty(answering.label) }) };

					return { target: "posting", context: { ...outcome({ enter: "thread", say: SAY.posting(answering.label) }), answering: { ...answering, posted: event.text } } };
				},
				posted: { context: outcome({}) },
				postFailed: { context: outcome({}) },
				postUnconfirmed: { context: outcome({}) },
				restarted: toOff({}),
			},
		},
		posting: {
			on: {
				filled: ({ context }) => ({ context: outcome({ say: SAY.posting(context.answering.label) }) }),
				edited: { context: outcome({}) },
				changed: { context: outcome({}) },
				submitted: ({ context, event }) =>
					isOwners(event.origin) ? { context: outcome({ enter: "nowhere", say: SAY.posting(context.answering.label) }) } : { context: outcome({ enter: "claude" }) },
				posted: ({ context: { answering }, event }) => toOff({ box: event.box === answering.posted ? setBox("") : KEEP, say: SAY.posted(answering.label) }),
				postFailed: ({ context: { answering }, event }) => {
					const say = SAY.failed(answering.label, event.cause);

					if (isEmptyBox(event.box) || event.box === answering.posted)
						return { target: "on", context: { ...outcome({ box: setBox(answering.posted), say }), answering: answeringOf(answering) } };

					return followBox(answeringOf(answering), event.box, say);
				},
				postUnconfirmed: ({ context: { answering }, event }) =>
					toOff({ box: event.box === answering.posted ? setBox("") : KEEP, say: SAY.unconfirmed(answering.label, event.cause) }),
				restarted: toOff({}),
			},
		},
	},
});

export type AnswerEvent = Parameters<typeof answerMachine.transition>[1];

export const ANSWER_EVENTS = ["filled", "edited", "changed", "submitted", "posted", "postFailed", "postUnconfirmed", "restarted"] as const satisfies readonly AnswerEvent["type"][];

export const ANSWER_STATES = ["off", "on", "posting"] as const satisfies readonly AnswerSnapshot["value"][];

/** The text the thread receives: the box without the opener. */
export const postedText = ({ posted, opener }: Posting): string => posted.slice(opener.length).trim();
