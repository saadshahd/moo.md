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

const Row = z.object({ item: name, title: name, level: z.optional(name), state: name, since: time });

/** An unclear item carries the mark apart from its risk level. */
export const InFlight = z.extend(Row, { unclear: z.boolean() });

/** A question to the owner: its text and the option words an answer may pick, none for a free answer. */
export const Question = z.object({ item: name, text: name, options: z.array(name), since: time });

export type Question = z.infer<typeof Question>;

export const Merged = z.object({ item: name, title: name, level: z.optional(name), mergedAt: time });

export const Choice = z.object({ item: name, text: name, at: time });

export type Choice = z.infer<typeof Choice>;

/** A path rule the owner's answer added, with the command that takes it back. */
const LearnedRule = z.object({ glob: name, level: name, item: name, at: time, undo: Action });

const PerMerge = z.object({
	merges: z.int().check(z.nonnegative()),
	/** Items that never merged in the window; their costs are in the numbers. */
	abandoned: z.int().check(z.nonnegative()),
	notes: z.number().check(z.nonnegative()),
	questions: z.number().check(z.nonnegative()),
	tokens: z.number().check(z.nonnegative()),
});

/** Per merged change over the last `window` merged changes, and over each path's own last `window`. */
export const Measure = z.extend(PerMerge, {
	window: z.int().check(z.positive()),
	byPath: z.array(z.extend(PerMerge, { glob: name })),
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
	inFlight: z.array(InFlight),
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
