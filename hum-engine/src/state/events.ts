import { join } from "node:path";
import { z } from "zod";
import { Json } from "../config/json.ts";
import { climb, type Steps } from "../config/migrate.ts";
import type { Faults, Outcome } from "./faults.ts";
import { ENGINE_VERSION, isNewerThan, UPDATE_ENGINE } from "./format.ts";
import { createOnce, listRecords, readJson, slug } from "./fs.ts";
import { SNAPSHOT_CARDS } from "./items.ts";

/** The record shape this engine writes to an item's log. A change here is public surface: every later engine reads each format an earlier one wrote. */
export const LOG_FORMAT = 1;

const name = z.string().min(1);

/** A log record as its file holds it, at any format. */
const LogRecord = z.record(z.string(), Json);

type LogRecord = z.infer<typeof LogRecord>;

/**
 * One step per earlier format, each rewriting a record at that format into the next one's shape, with no clock and no
 * I/O. Format 0 is every record hum wrote before 0.5.0, which named no format and no engine; hum 0.1.0 saved the
 * owner's answer as `answer`.
 */
const LOG_MIGRATIONS: Steps<LogRecord> = {
	0: (record) => (record.type === "answer" ? { ...record, type: "answered" } : record),
};

/** What every format of a record carries: enough to place it in its log, and to refuse one from a newer engine before reading the rest. */
const Placed = z.looseObject({
	format: z.int().nonnegative().default(0),
	engineVersion: name.optional(),
	source: name,
	sourceId: name,
	itemId: name,
	receivedAt: z.int().nonnegative(),
	seq: z.int().nonnegative().optional(),
});

type Placed = z.infer<typeof Placed>;

export const SavedEvent = z.object({
	format: z.literal(LOG_FORMAT),
	/** The engine that wrote the record; one from before hum 0.5.0 names none. */
	engineVersion: name.optional(),
	/** The version of the item's kind machine that a machine entry, a machine start or a model answer was made under. */
	machineVersion: name.optional(),
	/** Where the event came from, such as a thread comment id: a second read of it adds nothing. */
	source: name,
	sourceId: name,
	itemId: name,
	type: name,
	receivedAt: z.int().nonnegative(),
	/** The event's place in its item's log. An event saved before hum kept places has none, and comes first, by when it arrived. */
	seq: z.int().nonnegative().optional(),
	payload: Json,
});

export type SavedEvent = z.infer<typeof SavedEvent>;

export type NewEvent = Omit<SavedEvent, "format" | "engineVersion" | "receivedAt" | "seq">;

/** A record found in an item's log, with what places it. */
type Found = { readonly record: LogRecord; readonly placed: Placed };

/**
 * Every event is saved before anything acts on it, keyed by source, so reading one twice adds nothing; each new one
 * takes the next place in its item's log. A record a newer engine wrote is never read: it raises one card.
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
	#current({ record, placed }: Found): SavedEvent {
		return SavedEvent.parse(climb(record, placed.format, LOG_FORMAT, LOG_MIGRATIONS, "format"));
	}

	/** An item's records as their files hold them, in the order its log took them. */
	#records(itemId: string): Found[] {
		return listRecords(join(this.#folder, slug(itemId)))
			.map((file) => this.#found(LogRecord.parse(readJson(file))))
			.sort(({ placed: a }, { placed: b }) => (a.seq ?? -1) - (b.seq ?? -1) || a.receivedAt - b.receivedAt || (a.sourceId < b.sourceId ? -1 : 1));
	}

	/** Saves the event at the end of its item's log. `added` is false when this source and id are already in the log. */
	add(event: NewEvent): { readonly added: boolean; readonly event: SavedEvent } {
		const saved = SavedEvent.parse({ ...event, format: LOG_FORMAT, engineVersion: this.#engineVersion, receivedAt: this.#now(), seq: this.#nextPlace(event.itemId) });
		const added = createOnce(this.#path(saved), `${JSON.stringify(saved)}\n`);

		return added ? { added, event: saved } : { added, event: this.get(saved) };
	}

	/** Copies an item's records into another log as their writers wrote them, each at the next place there; a record already there stays. */
	copyTo(into: EventLog, itemId: string): void {
		for (const { record, placed } of this.#records(itemId)) createOnce(into.#path(placed), `${JSON.stringify({ ...record, seq: into.#nextPlace(itemId) })}\n`);
	}

	/** One record; one a newer engine wrote throws. */
	get(key: Pick<SavedEvent, "itemId" | "source" | "sourceId">): SavedEvent {
		const found = this.#found(LogRecord.parse(readJson(this.#path(key))));
		const refusal = this.#refusal(found);

		if (refusal !== undefined) throw new Error(refusal);

		return this.#current(found);
	}

	/** An item's events in the order its log took them, or one card when a newer engine wrote any of them. */
	read(itemId: string): Outcome<SavedEvent[]> {
		const found = this.#records(itemId);
		const refusal = found.map((each) => this.#refusal(each)).find((cause) => cause !== undefined);

		if (refusal !== undefined) return { ok: false, fault: this.#faults.raise({ code: SNAPSHOT_CARDS.newerEngine, item: itemId, cause: refusal, fix: UPDATE_ENGINE }) };

		return { ok: true, value: found.map((each) => this.#current(each)) };
	}

	/** As `read`, for a caller past a `read` that let the item go on: a record from a newer engine throws. */
	list(itemId: string): SavedEvent[] {
		const log = this.read(itemId);

		if (!log.ok) throw new Error(log.fault.cause);

		return log.value;
	}
}
