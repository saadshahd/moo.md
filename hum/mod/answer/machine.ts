import type { AnswerContext, Answering, AnswerState, BoxWrite } from "../../types";
import { createFSM } from "../vendor/libs.js";

export type { AnswerContext, Answering, BoxWrite };

/** The prompt box's events, each with the box as it stands. */
export type AnswerEvent =
	| { readonly type: "fill"; readonly answer: Answering; readonly box: string }
	| { readonly type: "edit"; readonly box: string }
	| { readonly type: "change"; readonly origin: string; readonly box: string }
	| { readonly type: "submit"; readonly origin: string; readonly text: string }
	| { readonly type: "postOk"; readonly box: string }
	| { readonly type: "postFail"; readonly cause: string; readonly box: string }
	/** The post ran past its limit or never reported: the answer may be on the thread. */
	| { readonly type: "postUnknown"; readonly cause: string; readonly box: string }
	| { readonly type: "restart" };

export type AnswerEventType = AnswerEvent["type"];

export const ANSWER_EVENTS = [
	"fill",
	"edit",
	"change",
	"submit",
	"postOk",
	"postFail",
	"postUnknown",
	"restart",
] as const satisfies readonly AnswerEventType[];

export const ANSWER_STATES = ["off", "on", "posting"] as const satisfies readonly AnswerState[];

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
	unknown: (label: string, cause: string) => `${label}: may have posted, ${cause}. Read its thread before you post again.`,
} as const;

const KEEP: BoxWrite = { kind: "keep" };

const setBox = (text: string): BoxWrite => ({ kind: "set", text });

/** Every event starts from a quiet outcome: Enter untouched, the box kept, nothing said. */
const outcome = (patch: Partial<AnswerContext>): AnswerContext => ({
	enter: "untouched",
	box: KEEP,
	say: undefined,
	...patch,
});

const isOwners = (origin: string): boolean => OWNER_ORIGINS.has(origin);

const isEmptyBox = (box: string): boolean => box.trim() === "";

const keepsOpener = (answering: Answering | undefined, box: string): boolean =>
	answering !== undefined && box.startsWith(answering.opener);

const isBare = (answering: Answering, text: string): boolean =>
	answering.isOpen && text.trim() === answering.filled.trim();

const labelOf = (answering: Answering | undefined): string =>
	answering?.label ?? "the item";

/** On while the box still starts with the opener; off once it does not. */
const followBox = (answering: Answering | undefined, box: string) =>
	keepsOpener(answering, box)
		? {
				target: "on" as const,
				context: outcome({
					answering: answering && { ...answering, posted: undefined },
				}),
			}
		: { target: "off" as const, context: outcome({ answering: undefined }) };

const toOff = {
	target: "off" as const,
	context: outcome({ answering: undefined }),
};

/**
 * Answer mode: while it is on, the owner's Enter posts on the item's thread instead of reaching Claude. Every event
 * has a transition in every state, so no event is ever ignored without a decision.
 */
export const answerMachine = createFSM<AnswerContext, AnswerEvent, { readonly [S in AnswerState]: S }>({
	initial: "off",
	context: outcome({}),
	states: {
		off: {
			on: {
				fill: ({ event }) =>
					isEmptyBox(event.box)
						? {
								target: "on",
								context: outcome({
									answering: event.answer,
									box: setBox(event.answer.filled),
								}),
							}
						: { context: outcome({ say: SAY.draft }) },
				edit: { context: outcome({}) },
				change: { context: outcome({}) },
				submit: { context: outcome({ enter: "claude" }) },
				postOk: { context: outcome({}) },
				postFail: { context: outcome({}) },
				postUnknown: { context: outcome({}) },
				restart: toOff,
			},
		},
		on: {
			on: {
				fill: ({ context }) => ({
					context: outcome({ answering: context.answering, say: SAY.draft }),
				}),
				edit: ({ context, event }) => followBox(context.answering, event.box),
				change: ({ context, event }) =>
					event.origin === SUBMIT_CLEAR
						? { context: outcome({ answering: context.answering }) }
						: followBox(context.answering, event.box),
				submit: ({ context, event }) => {
					const { answering } = context;

					if (!isOwners(event.origin))
						return { context: outcome({ answering, enter: "claude" }) };

					if (
						answering === undefined ||
						!event.text.startsWith(answering.opener)
					)
						return {
							target: "off",
							context: outcome({ answering: undefined, enter: "claude" }),
						};

					if (isBare(answering, event.text))
						return {
							context: outcome({
								answering,
								enter: "nowhere",
								say: SAY.empty(answering.label),
							}),
						};

					return {
						target: "posting",
						context: outcome({
							answering: { ...answering, posted: event.text },
							enter: "thread",
							say: SAY.posting(answering.label),
						}),
					};
				},
				postOk: ({ context }) => ({
					context: outcome({ answering: context.answering }),
				}),
				postFail: ({ context }) => ({
					context: outcome({ answering: context.answering }),
				}),
				postUnknown: ({ context }) => ({
					context: outcome({ answering: context.answering }),
				}),
				restart: toOff,
			},
		},
		posting: {
			on: {
				fill: ({ context }) => ({
					context: outcome({
						answering: context.answering,
						say: SAY.posting(labelOf(context.answering)),
					}),
				}),
				edit: ({ context }) => ({
					context: outcome({ answering: context.answering }),
				}),
				change: ({ context }) => ({
					context: outcome({ answering: context.answering }),
				}),
				submit: ({ context, event }) =>
					isOwners(event.origin)
						? {
								context: outcome({
									answering: context.answering,
									enter: "nowhere",
									say: SAY.posting(labelOf(context.answering)),
								}),
							}
						: {
								context: outcome({
									answering: context.answering,
									enter: "claude",
								}),
							},
				postOk: ({ context, event }) => {
					const posted = context.answering?.posted;

					return {
						target: "off",
						context: outcome({
							answering: undefined,
							box: event.box === posted ? setBox("") : KEEP,
							say: SAY.posted(labelOf(context.answering)),
						}),
					};
				},
				postFail: ({ context, event }) => {
					const { answering } = context;
					const posted = answering?.posted ?? "";
					const say = SAY.failed(labelOf(answering), event.cause);

					if (isEmptyBox(event.box) || event.box === posted)
						return {
							target: "on",
							context: outcome({
								answering: answering && { ...answering, posted: undefined },
								box: setBox(posted),
								say,
							}),
						};

					const followed = followBox(answering, event.box);

					return {
						target: followed.target,
						context: { ...followed.context, say },
					};
				},
				postUnknown: ({ context, event }) => ({
					target: "off",
					context: outcome({
						answering: undefined,
						box: event.box === context.answering?.posted ? setBox("") : KEEP,
						say: SAY.unknown(labelOf(context.answering), event.cause),
					}),
				}),
				restart: toOff,
			},
		},
	},
});

export type AnswerSnapshot = typeof answerMachine.initialState;

/** The text the thread receives: the box without the opener. */
export const postedText = (answering: Answering): string =>
	(answering.posted ?? "").slice(answering.opener.length).trim();
