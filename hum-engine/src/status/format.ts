import { z } from "zod";
import { SCHEMA_VERSION } from "../config/schema.ts";
import { ADAPTER_API_VERSION } from "../adapter-api.ts";

/** The status file's shape version. The view reads exactly this; a change here is public surface. */
export const STATUS_FORMAT = 1;

const name = z.string().min(1);

const ACTION_LABEL_CELLS = 14;
const time = z.number().int().nonnegative();

/** At most one action. A label is at most 14 cells, the width the view gives it. */
export const Action = z.strictObject({ label: name.max(ACTION_LABEL_CELLS), command: name });

/** The cause, the fix in one sentence, then at most one action. */
export const Card = z.strictObject({
	kind: z.enum(["waiting", "limited", "fault"]),
	/** One card per key: a failure code plus the item it hit. */
	key: name,
	item: name.optional(),
	code: name,
	cause: name,
	fix: name.refine((fix) => !fix.includes("\n"), "the fix is one sentence on one line"),
	action: Action.optional(),
	since: time,
});

export type Card = z.infer<typeof Card>;

const Row = z.strictObject({ item: name, title: name, level: name.optional(), state: name, since: time });

/** An unclear item carries the mark apart from its risk level. */
export const InFlight = Row.extend({ unclear: z.boolean() });

/** A question to the owner; the status file carries its text. */
export const Question = z.strictObject({ item: name, text: name, since: time });

export const Merged = z.strictObject({ item: name, title: name, level: name.optional(), mergedAt: time });

export const Choice = z.strictObject({ item: name, text: name, at: time });

/** A path rule the owner's answer added, with the command that takes it back. */
export const LearnedRule = z.strictObject({ glob: name, level: name, item: name, at: time, undo: Action });

/** Per merged change over the last `window` merged changes. */
export const Measure = z.strictObject({
	window: z.int().positive(),
	merges: z.int().nonnegative(),
	notes: z.number().nonnegative(),
	questions: z.number().nonnegative(),
	tokens: z.number().nonnegative(),
});

export type Measure = z.infer<typeof Measure>;

/** One file per repo; the view shows the sections in this order. */
export const Status = z.strictObject({
	format: z.literal(STATUS_FORMAT),
	/** Freshness is a pure function of these timestamps and the clock. */
	writtenAt: time,
	/** When each runner's worker last wrote; absent when it never has. */
	workers: z.strictObject({ mac: time.optional(), ci: time.optional() }),
	engine: z.strictObject({
		version: name,
		adapterApi: z.int().nonnegative(),
		configSchema: z.int().positive(),
		/** The newest published version, when the worker could read it. */
		latest: name.optional(),
	}),
	questions: z.array(Question),
	cards: z.array(Card),
	inFlight: z.array(InFlight),
	merged: z.array(Merged),
	choices: z.array(Choice),
	rules: z.array(LearnedRule),
	measure: Measure.nullable(),
});

export type Status = z.infer<typeof Status>;

/** A status with nothing in it, stamped with the engine that wrote it. */
export const emptyStatus = (engineVersion: string, writtenAt: number): Status => ({
	format: STATUS_FORMAT,
	writtenAt,
	workers: {},
	engine: { version: engineVersion, adapterApi: ADAPTER_API_VERSION, configSchema: SCHEMA_VERSION },
	questions: [],
	cards: [],
	inFlight: [],
	merged: [],
	choices: [],
	rules: [],
	measure: null,
});

/** What the worker writes each tick. The service unit shows a card when it is three ticks old. */
export const Heartbeat = z.strictObject({
	time,
	engineVersion: name,
	configHash: name,
	/** Items with a run going. */
	inFlight: z.array(name),
	/** The time between ticks, so a reader can tell three ticks old from fresh. */
	intervalMs: z.int().positive(),
	/** Set once the worker has seen an update and will exit when its runs end. */
	restarting: name.optional(),
});

export type Heartbeat = z.infer<typeof Heartbeat>;
