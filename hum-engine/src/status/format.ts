/*
 * The mod bundles this file for its reader: zod's mini build keeps that bundle small, where the full one brings
 * every locale. Mini loads none, so the English messages are loaded here, for a reader that loads nothing else.
 */
import * as z from "zod/mini";
import en from "zod/v4/locales/en.js";
import { STATUS_FORMAT } from "./version.ts";

z.config(en());

export { STATUS_FORMAT };

const name = z.string().check(z.minLength(1));

const ACTION_LABEL_CELLS = 14;

const label = z.string().check(z.minLength(1), z.maxLength(ACTION_LABEL_CELLS));
const time = z.int().check(z.nonnegative());

/** A command the owner may run. A label is at most 14 cells, the width the view gives it. */
export const Action = z.object({ label, command: name });

/** A card's action: it fills the prompt with this answer to the card's item, and only the owner's Enter posts it. */
export const CardAction = z.object({ label, answer: name });

/** The most characters of a tool's own words a card quotes. */
export const CARD_EXCERPT = 200;

/** The cause, the fix in one sentence, then at most one action. */
export const Card = z.object({
	kind: z.enum(["waiting", "limited", "fault"]),
	/** One card per key: a failure code plus the item it hit. */
	key: name,
	item: z.optional(name),
	code: name,
	cause: name,
	fix: name.check(z.refine((fix) => !fix.includes("\n"), "the fix is one sentence on one line")),
	action: z.optional(CardAction),
	since: time,
}).check(z.refine(({ item, action }) => action === undefined || item !== undefined, "a card's action answers its item, so a card with an action names one"));

export type Card = z.infer<typeof Card>;

/** A step of an item's flow, and whether the item waits there on the owner. */
const Step = z.object({ name, waitsOnOwner: z.boolean() });

/** What the owner may do at the step an item is in. */
export const Controls = z.object({
	/** The options the flow file offers there, each with the event it sends. */
	choices: z.array(z.object({ label: name, event: name })),
	/** It takes a written answer. */
	answer: z.boolean(),
	/** The flow file lets the owner skip it. */
	skip: z.boolean(),
	/** It waits on a timer the owner may run now. */
	runNow: z.boolean(),
	/** The steps a note may go to: each the item can still reach. */
	noteTo: z.array(name),
});

export type Controls = z.infer<typeof Controls>;

/** A Rail row of an item's Workstream on roundup: its name, its Agent id, its Status there, and the link that opens its pane in the roundup App. */
export const ItemRow = z.object({ name, agent: name, state: name, link: name });

export type ItemRow = z.infer<typeof ItemRow>;

/** A Pad the owner opens in the roundup App: its name and its link. */
export const PadLink = z.object({ name, link: name });

export type PadLink = z.infer<typeof PadLink>;

/** Where the owner opens an item on roundup: the rows of its Workstream, the row of its newest question, and its handoff Pad where one stands. */
export type ItemLinks = { readonly rows: ItemRow[]; readonly ask?: ItemRow; readonly handoff?: PadLink };

/**
 * An item with a saved state that has not ended: its kind file and that flow's version, the flow's steps as the item
 * runs it, the step it is in since `since`, whether a pass runs on it now, and what the owner may do there. A wait a run
 * stops at past its token cap is a step only while the item is in it.
 */
export const OpenItem = z.object({
	item: name,
	/** Absent until the worker has read the item since it started. */
	title: z.optional(name),
	kind: name,
	flowVersion: name,
	steps: z.array(Step),
	at: name,
	/** The shown steps it has passed since its flow last started, in the order it first left each; absent where hum began keeping them after the item started. */
	passed: z.optional(z.array(name)),
	since: time,
	running: z.boolean(),
	controls: Controls,
	/** On roundup, the rows of the item's Workstream, oldest first, and its handoff Pad where one stands. */
	rows: z.optional(z.array(ItemRow)),
	handoff: z.optional(PadLink),
});

export type OpenItem = z.infer<typeof OpenItem>;

/** A question to the owner: its text and the option words an answer may pick, none for a free answer; on roundup, the row the owner answers it in. */
export const Question = z.object({ item: name, text: name, options: z.array(name), since: time, row: z.optional(ItemRow) });

export type Question = z.infer<typeof Question>;

export const Merged = z.object({ item: name, title: name, level: z.optional(name), mergedAt: time });

/** What came of the item a choice was made on: it merged, or sits out stuck or waiting for the owner's review. */
const CHOICE_RESULTS = ["merged", "stuck", "review"] as const;

/**
 * A choice a run made without the owner: why code let it, the files the chosen option touches, and what came of its
 * item once something has. A record an older engine saved lacks the last three.
 */
export const Choice = z.object({ item: name, text: name, at: time, why: z.optional(name), files: z.optional(z.array(name)), result: z.optional(z.enum(CHOICE_RESULTS)) });

export type Choice = z.infer<typeof Choice>;

/** A path rule the owner's answer added, with the command that takes it back. */
const LearnedRule = z.object({ glob: name, level: name, item: name, at: time, undo: Action });

const count = z.int().check(z.nonnegative());

const PerMerge = z.object({
	merges: count,
	/** Items that never merged in the window; their costs are in the numbers. */
	abandoned: count,
	notes: z.number().check(z.nonnegative()),
	questions: z.number().check(z.nonnegative()),
	tokens: z.number().check(z.nonnegative()),
});

/** The merged changes that reached done one way, over that way's own last `window`, and how many of them a later change reverted or fixed. */
const DoneByBreaks = z.object({ doneBy: name, merges: count, reverted: count, fixed: count });

/**
 * Per merged change over the last `window` merged changes, and over each path's own last `window`; then the breaks
 * of each way of reaching done, which a status file an older engine wrote lacks.
 */
export const Measure = z.extend(PerMerge, {
	window: z.int().check(z.positive()),
	byPath: z.array(z.extend(PerMerge, { glob: name })),
	byDoneBy: z._default(z.array(DoneByBreaks), []),
});

export type Measure = z.infer<typeof Measure>;

/** One file per repo; the view shows the sections in this order. */
export const Status = z.object({
	format: z.literal(STATUS_FORMAT),
	/** Freshness is a pure function of these timestamps and the clock. */
	writtenAt: time,
	/** When each runner's worker last wrote; absent when it never has. */
	workers: z.object({ mac: z.optional(time), ci: z.optional(time) }),
	engine: z.object({
		version: name,
		adapterApi: z.int().check(z.nonnegative()),
		configSchema: z.int().check(z.positive()),
		/** The newest published version, when the worker could read it. */
		latest: z.optional(name),
	}),
	questions: z.array(Question),
	cards: z.array(Card),
	open: z.array(OpenItem),
	merged: z.array(Merged),
	choices: z.array(Choice),
	rules: z.array(LearnedRule),
	/** Pairs of review notes only a model found alike, waiting for its precision to reach the owner's bar. */
	possibleRepeats: z.array(z.object({ a: name, b: name })),
	/** memory.md rules no run applied in the last runs; the owner decides whether to keep them. */
	unusedMemory: z.array(z.string()),
	measure: z.nullable(Measure),
});

export type Status = z.infer<typeof Status>;

/** What the worker writes each tick. The service unit shows a card when it is three ticks old. */
export const Heartbeat = z.object({
	time,
	engineVersion: name,
	configHash: name,
	/** Items with a run going. */
	inFlight: z.array(name),
	/** The time between ticks, so a reader can tell three ticks old from fresh. */
	intervalMs: z.int().check(z.positive()),
	/** Set once the worker has seen an update and will exit when its runs end. */
	restarting: z.optional(name),
});

export type Heartbeat = z.infer<typeof Heartbeat>;
