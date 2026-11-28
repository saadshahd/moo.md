import * as z from "zod/mini";
import { REQUEST_KINDS, type RequestKind } from "../adapter-api.ts";
import { PARK_OPTIONS } from "../decide/answer.ts";
import { type DoneBy, OWNER_APPROVAL } from "../decide/merge.ts";
import { noteChoice } from "../decide/note.ts";
import { allowsRequest } from "../decide/request.ts";
import type { Landing, Parked } from "../state/saved.ts";
import { parkedWait } from "../worker/owner-answers.ts";
import { PARKED_CODES } from "../worker/thin-path.ts";
import { type Card, ItemRow, type OpenItem, PadLink, type Question, type Status } from "./format.ts";

/** The waits file's shape version. The panel reads exactly this; a change here is public surface. */
export const WAITS_FORMAT = 1;

const name = z.string().check(z.minLength(1));
const time = z.int().check(z.nonnegative());

/**
 * What the owner may do at a wait, named by the choice the item's log keeps in its `answered` record once they pick it:
 * an option word, skip, run-now, note:<step>, or empty for words alone; `words` where the pick carries their typed words.
 */
export const WaitAction = z.object({ label: name, choice: z.string(), words: z.boolean() });

export type WaitAction = z.infer<typeof WaitAction>;

/** The wait an action answers, as the owner's `answered` record names it: the step, and when the item entered it. */
const AnsweredWait = z.object({ step: z.optional(name), since: z.optional(time) });

/** What every entry about one item carries: when its wait began, the wait a pick answers where hum knows it, its open question, what the owner may do, and where they open the item. */
const itemFields = {
	item: name,
	title: z.optional(name),
	since: time,
	wait: z.optional(AnsweredWait),
	question: z.optional(name),
	actions: z.array(WaitAction),
	rows: z.optional(z.array(ItemRow)),
	pullRequest: z.optional(name),
	handoff: z.optional(PadLink),
};

const cardFields = { key: name, code: name, cause: name, fix: name };

/**
 * One thing waiting on the owner: an item at a step that waits on them, a change whose pull request waits for their
 * approval, a card about one item (a parked item's card carries the answers that release it), a question to an item
 * none of those names, or a card about hum itself, which the owner acts on as its fix says.
 */
export const WaitEntry = z.discriminatedUnion("from", [
	z.object({ from: z.literal("step"), ...itemFields, kind: name, step: name }),
	z.object({ from: z.literal("landing"), ...itemFields, why: name }),
	z.object({ from: z.literal("card"), ...itemFields, ...cardFields }),
	z.object({ from: z.literal("question"), ...itemFields, question: name }),
	z.object({ from: z.literal("hum"), ...cardFields, since: time }),
]);

export type WaitEntry = z.infer<typeof WaitEntry>;

/** The mark of when the owner last looked at the changes merged without them, beside the status file. */
export const Looked = z.object({ at: time });

/** Since when the merged changes count: the owner's last look, else their newest answer, request or note; none counts every one. */
const MergedSince = z.object({ by: z.enum(["looked", "answered"]), at: time });

/** The changes merged without the owner since `since`, and the look that marks them seen. */
export const MergedWithoutOwner = z.object({ count: z.int().check(z.nonnegative()), since: z.optional(MergedSince), actions: z.array(WaitAction) });

/** Every wait on the owner across items, oldest first, and the changes merged without them since they last looked. */
export const Waits = z.object({ format: z.literal(WAITS_FORMAT), writtenAt: time, waits: z.array(WaitEntry), merged: MergedWithoutOwner });

export type Waits = z.infer<typeof Waits>;

/**
 * What the waits read beside the status: the parked items, the saved landings with their pull requests, each merge
 * and how it reached done, the owner's last look, and when they last answered.
 */
export type WaitFacts = {
	readonly parked: readonly Parked[];
	readonly landings: readonly Pick<Landing, "item" | "since" | "pullRequest" | "awaitsOwner">[];
	readonly merges: readonly { readonly at: number; readonly doneBy: DoneBy | undefined }[];
	readonly looked: number | undefined;
	readonly answered: number | undefined;
};

/** The action that marks the merged changes seen: the panel writes the look's time where the owner opens the list. */
const LOOK: WaitAction = { label: "open the list", choice: "looked", words: false };

const sinceOf = (looked: number | undefined, answered: number | undefined) => {
	if (looked !== undefined) return { by: "looked", at: looked } as const;

	return answered === undefined ? undefined : ({ by: "answered", at: answered } as const);
};

/** The changes merged since the owner last looked, else since they last answered, that the owner's approval did not merge. */
const mergedWithoutOwner = ({ merges, looked, answered }: Pick<WaitFacts, "merges" | "looked" | "answered">): MergedWithoutOwner => {
	const since = sinceOf(looked, answered);

	return { count: merges.filter(({ at, doneBy }) => doneBy !== "owner" && (since === undefined || at > since.at)).length, since, actions: [LOOK] };
};

export type MergedWithoutOwner = z.infer<typeof MergedWithoutOwner>;

const REPLY: WaitAction = { label: "reply", choice: "", words: true };

const REQUEST_LABELS = { skip: "skip", "run-now": "run now" } as const satisfies Record<RequestKind, string>;

const pick = (label: string, choice: string): WaitAction => ({ label, choice, words: false });

const byChoice = (actions: readonly WaitAction[]): WaitAction[] => actions.filter((action, index) => actions.findIndex(({ choice }) => choice === action.choice) === index);

/** A question's picks: each option, else words. */
const questionActions = ({ options }: Question): WaitAction[] => (options.length > 0 ? options.map((option) => pick(option, option)) : [REPLY]);

/**
 * What the owner may do at the step an item waits at: the open question's options and each choice the engine gives an
 * answer word, words where the step or a question without options takes them, the requests the step allows, and a note
 * to each step the item can still reach.
 */
const stepActions = ({ controls }: OpenItem, question: Question | undefined): WaitAction[] =>
	byChoice([
		...(question?.options ?? []).map((option) => pick(option, option)),
		...controls.choices.flatMap(({ label, answer }) => (answer === undefined ? [] : [pick(label, answer)])),
		...(controls.answer || question?.options.length === 0 ? [REPLY] : []),
		...REQUEST_KINDS.filter((kind) => allowsRequest(kind, controls)).map((kind) => pick(REQUEST_LABELS[kind], kind)),
		...controls.noteTo.map((step) => ({ label: `note to ${step}`, choice: noteChoice(step), words: true })),
	]);

/** A pull request's approval, and the open question's options where the landing asks one. */
const landingActions = (question: Question | undefined): WaitAction[] => byChoice([pick(OWNER_APPROVAL, OWNER_APPROVAL), ...(question === undefined ? [] : questionActions(question))]);

/** The answers that release a parked item, its card's own action under the card's label. */
const parkActions = ({ why }: Parked, { action }: Card): WaitAction[] => PARK_OPTIONS[why].map((option) => pick(action?.answer === option ? action.label : option, option));

/** The wait a pick answers at an item no pass runs on: the step it is saved at, since it was saved there. */
const savedWait = (open: OpenItem | undefined) => (open === undefined || open.running ? undefined : { step: open.at, since: open.since });

const isAtOwnerWait = ({ steps, at, running }: OpenItem): boolean => !running && steps.some(({ name: step, waitsOnOwner }) => step === at && waitsOnOwner);

const oldestFirst = (a: WaitEntry, b: WaitEntry): number => a.since - b.since || ("item" in a ? a.item : a.key).localeCompare("item" in b ? b.item : b.key);

/**
 * Every wait on the owner the status shows, one entry each, oldest first: each item at a step that waits on them, each
 * change whose pull request waits for their approval since it was saved, each card, and each open question to an item
 * none of those names. A parked item's only wait is its card, so its step is no entry; an item a pass runs on waits on
 * no one.
 */
export const waitsOf = ({ open, questions, cards }: Pick<Status, "open" | "questions" | "cards">, facts: WaitFacts, writtenAt: number): Waits => {
	const { parked, landings } = facts;
	const parkedOf = new Map(parked.map((held) => [held.item, held]));
	const pullRequests = new Map(landings.flatMap(({ item, pullRequest }) => (pullRequest === undefined ? [] : [[item, pullRequest]])));
	const openOf = new Map(open.map((item) => [item.item, item]));
	const questionOf = new Map(questions.map((question) => [question.item, question]));

	const placesOf = (item: string) => {
		const found = openOf.get(item);

		return { item, title: found?.title, rows: found?.rows, pullRequest: pullRequests.get(item), handoff: found?.handoff };
	};

	const askedOf = (item: string) => ({ ...placesOf(item), question: questionOf.get(item)?.text });

	/** The park a card stands for: its item's, where the item is parked and the card is the one its park raised. */
	const parkOf = ({ item, code }: Card): Parked | undefined => {
		const held = item === undefined ? undefined : parkedOf.get(item);

		return held !== undefined && PARKED_CODES.includes(code) ? held : undefined;
	};

	const isIdle = (item: string): boolean => !parkedOf.has(item) && openOf.get(item)?.running !== true;
	const atSteps = open.filter((item) => isAtOwnerWait(item) && !parkedOf.has(item.item));
	const approving = landings.filter(({ item, awaitsOwner }) => awaitsOwner !== undefined && isIdle(item));
	const named = new Set([...atSteps, ...approving].map(({ item }) => item).concat(cards.flatMap((card) => parkOf(card)?.item ?? [])));

	const steps = atSteps.map((item): WaitEntry => ({ from: "step", ...askedOf(item.item), kind: item.kind, step: item.at, since: item.since, wait: savedWait(item), actions: stepActions(item, questionOf.get(item.item)) }));

	const landed = approving.map(({ item, since, awaitsOwner = "" }): WaitEntry => ({ from: "landing", ...askedOf(item), why: awaitsOwner, since, wait: savedWait(openOf.get(item)), actions: landingActions(questionOf.get(item)) }));

	const carded = cards.map((card): WaitEntry => {
		const { key, code, cause, fix, since, item } = card;
		const held = parkOf(card);

		if (item === undefined) return { from: "hum", key, code, cause, fix, since };

		return held === undefined
			? { from: "card", ...placesOf(item), key, code, cause, fix, since, actions: [] }
			: { from: "card", ...askedOf(item), key, code, cause, fix, since: held.since, wait: parkedWait(held), actions: parkActions(held, card) };
	});

	const asked = questions
		.filter(({ item }) => !named.has(item))
		.map((question): WaitEntry => ({ from: "question", ...placesOf(question.item), question: question.text, since: question.since, wait: savedWait(openOf.get(question.item)), actions: questionActions(question) }));

	return { format: WAITS_FORMAT, writtenAt, waits: [...steps, ...landed, ...carded, ...asked].sort(oldestFirst), merged: mergedWithoutOwner(facts) };
};
