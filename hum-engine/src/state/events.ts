import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { hashJson } from "../config/hash.ts";
import { Json } from "../config/json.ts";
import { climb, type Steps } from "../config/migrate.ts";
import { RESOLUTION_SOURCES } from "../decide/answer.ts";
import { DONE_BY } from "../decide/merge.ts";
import type { Faults, Outcome } from "./faults.ts";
import { updateEngineStep } from "../engine.ts";
import { ENGINE_VERSION, isNewerThan } from "./format.ts";
import { createOnce, listRecords, readJson, slug } from "./fs.ts";
import { SNAPSHOT_CARDS } from "./items.ts";

/** The record shape this engine writes to an item's log. A change here is public surface: every later engine reads each format an earlier one wrote. */
export const LOG_FORMAT = 2;

const name = z.string().min(1);
const count = z.int().nonnegative();
const models = z.array(name);

/** A log record as its file holds it, at any format. */
const LogRecord = z.record(z.string(), Json);

type LogRecord = z.infer<typeof LogRecord>;

/**
 * One step per earlier format, each rewriting a record at that format into the next one's shape, with no clock and no
 * I/O. Format 0 is every record hum wrote before 0.5.0, an `answered` or a `merged` with no format and no engine: it
 * reads as format 1 unchanged. Format 1's `answered` kept only that the owner's answer took effect, with an empty
 * payload: it reads as format 2's `answer-applied`.
 */
const LOG_MIGRATIONS: Steps<LogRecord> = {
	0: (record) => record,
	1: (record) => (record.type === "answered" ? { ...record, type: "answer-applied" } : record),
};

/** What every format of a record carries: enough to place it in its log, and to refuse one from a newer engine before reading the rest. */
const Placed = z.looseObject({
	format: z.int().nonnegative().default(0),
	/** The engine that wrote the record; one from before hum 0.5.0 names none. */
	engineVersion: name.optional(),
	/** Where the event came from, such as a thread comment id: a second read of it adds nothing. */
	source: name,
	sourceId: name,
	itemId: name,
	receivedAt: count,
	/** The event's place in its item's log. An event saved before hum kept places has none, and comes first, by when it arrived. */
	seq: count.optional(),
});

type Placed = z.infer<typeof Placed>;

/**
 * A model run's answer as the log keeps it: a finished run's report, or the tokens a run spent before the item's cap
 * stopped it. The log owns this shape, so a change to the runner's own type leaves format 1 as it is.
 */
export const KeptOutcome = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("finished"),
		subtype: name,
		isError: z.boolean(),
		sessionId: name.optional(),
		text: z.string(),
		structured: Json.optional(),
		tokens: count,
		cacheReadTokens: count,
		plugins: z.array(name),
		keySource: name.optional(),
		models,
	}),
	z.object({ kind: z.literal("over-cap"), tokens: count }),
]);

export type KeptOutcome = z.infer<typeof KeptOutcome>;

/** A plan or review run's pick as the log keeps it: the event, how sure the run was, why, and what it cited, planned, asked or split into. */
const KeptPick = z.object({
	event: name,
	sure: z.boolean(),
	reason: z.string(),
	cites: z.array(z.object({ file: name, line: z.int().positive() })),
	plan: z.object({ summary: name, steps: z.array(name), paths: z.array(name) }).optional(),
	question: z.string().optional(),
	parts: z.array(name),
});

const grade = z.enum(["sound", "partial", "concern"]);

/** What a judge picked for the item: a plan or review run's pick and the models that answered it, or the alignment call's grades or why it abstained. A review and the alignment call judge the change that ends at `head`. */
const Picked = z.discriminatedUnion("judge", [
	z.object({ judge: z.literal("plan"), pick: KeptPick, models }),
	z.object({ judge: z.literal("review"), head: name, pick: KeptPick, models }),
	z.object({ judge: z.literal("alignment"), head: name, alignment: z.union([z.object({ graded: z.object({ alignment: grade, verification: grade }) }), z.object({ abstained: name })]) }),
]);

/**
 * The owner wait an answer was given at: the step, where the machine's state has a plain name, and when the item
 * entered it, where the answer came during that visit. An answer counts only for the wait it names, so one given at an
 * earlier visit never applies to a later one.
 */
export const Wait = z.object({ step: name.optional(), since: count.optional() });

export type Wait = z.infer<typeof Wait>;

/**
 * The owner's answer, request or note, read once from the surface that gave it: the wait it was given at, absent where
 * it came at no wait hum knows; the choice it picks, empty for words alone; the owner's words as written; when they
 * gave it; and how its choice was read, so a model's reading stays told apart from the owner's own pick.
 */
export const KeptAnswer = z.object({ wait: Wait.optional(), choice: z.string(), text: z.string(), at: count, read: z.enum(Object.values(RESOLUTION_SOURCES)) });

export type KeptAnswer = z.infer<typeof KeptAnswer>;

/** What a record at this engine's format carries to place it: the same fields as at any format, at this format alone. */
const envelope = { ...Placed.shape, format: z.literal(LOG_FORMAT) };

/** The version of the item's kind machine the record was made under. */
const machineVersion = name;

/** A log record at this engine's format: where it came from, its place, and, by type, the fact it keeps. Each type names something that happened. The log owns every shape here. */
export const SavedEvent = z.discriminatedUnion("type", [
	z.object({ ...envelope, machineVersion, type: z.literal("machine-started"), payload: z.object({ afresh: z.boolean() }) }),
	z.object({ ...envelope, machineVersion, type: z.literal("model-answered"), payload: z.object({ run: name, attempt: count, question: name.optional(), outcome: KeptOutcome }) }),
	z.object({ ...envelope, type: z.literal("picked"), payload: Picked }),
	z.object({ ...envelope, type: z.literal("landing-found"), payload: z.object({ head: name, doneBy: z.enum(DONE_BY) }) }),
	z.object({ ...envelope, type: z.literal("answered"), payload: KeptAnswer }),
	z.object({ ...envelope, type: z.literal("answer-applied"), payload: z.object({}) }),
	z.object({ ...envelope, type: z.literal("merged"), payload: z.object({}) }),
	z.object({ ...envelope, type: z.literal("rebuilt"), payload: z.object({ why: z.string() }) }),
]);

export type SavedEvent = z.infer<typeof SavedEvent>;

/** What the log stamps on each record it saves. */
type Stamped = "format" | "engineVersion" | "receivedAt" | "seq";

/** An event as its writer gives it. One with no `sourceId` is keyed by its content and the place it takes in its item's log. */
export type NewEvent = { [Type in SavedEvent["type"]]: Omit<Extract<SavedEvent, { type: Type }>, Stamped | "sourceId"> & { readonly sourceId?: string } }[SavedEvent["type"]];

/** A record found in an item's log, with what places it. */
type Found = { readonly record: LogRecord; readonly placed: Placed };

/** What the owner does about a log record this engine cannot read. */
const DAMAGED_RECORD_FIX = "Restore the record from a backup, or delete it; the other items go on.";

/**
 * Every event is saved before anything acts on it, keyed by source, so reading one twice adds nothing; each new one
 * takes the next place in its item's log. A record a newer engine wrote, or one this engine cannot read, is never
 * read: it raises one card for its item.
 */
export class EventLog {
	readonly #folder: string;
	readonly #now: () => number;
	readonly #faults: Faults;
	readonly #engineVersion: string;

	constructor(folder: string, now: () => number, faults: Faults, engineVersion: string = ENGINE_VERSION) {
		this.#folder = folder;
		this.#now = now;
		this.#faults = faults;
		this.#engineVersion = engineVersion;
	}

	#path({ itemId, source, sourceId }: Pick<SavedEvent, "itemId" | "source" | "sourceId">): string {
		return join(this.#folder, slug(itemId), `${slug(`${source}\u0000${sourceId}`)}.json`);
	}

	#nextPlace(itemId: string): number {
		return listRecords(join(this.#folder, slug(itemId))).length;
	}

	#found(record: LogRecord): Found {
		return { record, placed: Placed.parse(record) };
	}

	/** Why this engine refuses the record, when a newer one wrote it. */
	#refusal({ placed }: Found): string | undefined {
		if (!isNewerThan(placed, { format: LOG_FORMAT, engineVersion: this.#engineVersion })) return undefined;

		return `The log of ${placed.itemId} holds a record hum ${placed.engineVersion ?? "of an unknown version"} wrote in format ${placed.format}; the running ${this.#engineVersion} reads up to format ${LOG_FORMAT}.`;
	}

	/** The record in this engine's format, climbed from the one it was written in. */
	#current({ record, placed }: Found) {
		return SavedEvent.safeParse(climb(record, placed.format, LOG_FORMAT, LOG_MIGRATIONS, "format"));
	}

	/** An item's records as their files hold them, in the order its log took them. */
	#records(itemId: string): Found[] {
		return listRecords(join(this.#folder, slug(itemId)))
			.map((file) => this.#found(LogRecord.parse(readJson(file))))
			.sort(({ placed: a }, { placed: b }) => (a.seq ?? -1) - (b.seq ?? -1) || a.receivedAt - b.receivedAt || (a.sourceId < b.sourceId ? -1 : 1));
	}

	/** Saves the event at the end of its item's log. `added` is false when this source and id are already in the log. */
	add({ sourceId, ...event }: NewEvent): { readonly added: boolean; readonly event: SavedEvent } {
		const seq = this.#nextPlace(event.itemId);
		const saved = SavedEvent.parse({ ...event, sourceId: sourceId ?? hashJson({ type: event.type, payload: event.payload, seq }), format: LOG_FORMAT, engineVersion: this.#engineVersion, receivedAt: this.#now(), seq });
		const added = createOnce(this.#path(saved), `${JSON.stringify(saved)}\n`);

		return added ? { added, event: saved } : { added, event: this.get(saved) };
	}

	/** Copies an item's records into another log as their writers wrote them, each at the next place there; a record already there stays. */
	copyTo(into: EventLog, itemId: string): void {
		for (const { record, placed } of this.#records(itemId)) createOnce(into.#path(placed), `${JSON.stringify({ ...record, seq: into.#nextPlace(itemId) })}\n`);
	}

	/** One record, or undefined where the log keeps none under this key; one a newer engine wrote, or one this engine cannot read, throws. */
	find(key: Pick<SavedEvent, "itemId" | "source" | "sourceId">): SavedEvent | undefined {
		return existsSync(this.#path(key)) ? this.get(key) : undefined;
	}

	/** One record; one a newer engine wrote, or one this engine cannot read, throws. */
	get(key: Pick<SavedEvent, "itemId" | "source" | "sourceId">): SavedEvent {
		const found = this.#found(LogRecord.parse(readJson(this.#path(key))));
		const refusal = this.#refusal(found);

		if (refusal !== undefined) throw new Error(refusal);

		const current = this.#current(found);

		if (!current.success) throw current.error;

		return current.data;
	}

	/** An item's events in the order its log took them, or one card when a newer engine wrote any of them or this engine cannot read one. */
	read(itemId: string): Outcome<SavedEvent[]> {
		const found = this.#records(itemId);
		const refusal = found.map((each) => this.#refusal(each)).find((cause) => cause !== undefined);

		if (refusal !== undefined) return { ok: false, fault: this.#faults.raise({ code: SNAPSHOT_CARDS.newerEngine, item: itemId, cause: refusal, fix: updateEngineStep() }) };

		const events: SavedEvent[] = [];

		for (const each of found) {
			const current = this.#current(each);

			if (!current.success) return { ok: false, fault: this.#faults.raise({ code: SNAPSHOT_CARDS.unreadable, item: itemId, cause: `The log of ${itemId} holds a record from ${each.placed.source} that hum cannot read: ${z.prettifyError(current.error)}`, fix: DAMAGED_RECORD_FIX }) };

			events.push(current.data);
		}

		return { ok: true, value: events };
	}

	/** As `read`, for a caller past a `read` that let the item go on: a record from a newer engine, or one this engine cannot read, throws. */
	list(itemId: string): SavedEvent[] {
		const log = this.read(itemId);

		if (!log.ok) throw new Error(log.fault.cause);

		return log.value;
	}
}
